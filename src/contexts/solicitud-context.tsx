import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

import { STORAGE_KEYS } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { LineaSolicitud } from '@/lib/types';

interface SolicitudContextValue {
  lineas: LineaSolicitud[];
  clienteObjetivoId: string | null;
  setClienteObjetivoId: (id: string | null) => void;
  anadir: (linea: LineaSolicitud) => void;
  quitar: (productoId: string) => void;
  cambiarCantidad: (productoId: string, delta: number) => void;
  reemplazar: (lineas: LineaSolicitud[]) => void;
  vaciar: () => void;
  total: number;
  // Proveedor del carrito activo (derivado de su primera línea).
  proveedorDelCarrito: { id: string; nombre: string } | null;
  // Aviso global (p. ej. intento de mezclar proveedores) y su cierre manual.
  aviso: string | null;
  limpiarAviso: () => void;
}

const SolicitudContext = React.createContext<SolicitudContextValue | null>(null);

// Clave del cubo que guarda el carrito del PROPIO usuario (clientes, o un
// comercial pidiendo para sí mismo cuando no tiene cliente seleccionado).
// El resto de claves del mapa son clienteId (UUID): un borrador por cliente.
const CLAVE_PROPIA = 'propia';

// Forma persistida en AsyncStorage (STORAGE_KEYS.carritos).
interface EstadoPersistido {
  carritos: Record<string, LineaSolicitud[]>;
  clienteObjetivoId: string | null;
}

// Solicitudes en curso (carritos de pedido). Se mantiene UN BORRADOR POR
// CUBO para que un comercial no mezcle pedidos de distintos clientes:
//   - cubo 'propia': carrito del usuario autenticado;
//   - cubo <clienteId>: borrador del pedido que el comercial prepara para
//     ese cliente. Cambiar de cliente solo cambia el cubo activo (no toca
//     los datos de los demás). Se persiste en el dispositivo para tolerar
//     reinicios de la app; el pedido real se crea con el RPC crear_pedido.
export function SolicitudProvider({ children }: { children: React.ReactNode }) {
  const [carritos, setCarritos] = React.useState<Record<string, LineaSolicitud[]>>({});
  const [clienteObjetivoId, setClienteObjetivoId] = React.useState<string | null>(null);
  const [hidratado, setHidratado] = React.useState(false);

  // Los borradores se aíslan por CUENTA: cada usuario autenticado tiene su
  // propia clave de almacenamiento, para que en un dispositivo compartido un
  // cliente no vea (ni envíe) el carrito o los borradores de otro usuario.
  const { session, perfil, refreshPerfil } = useAuth();
  const uid = session?.user?.id ?? null;
  // Los anónimos también persisten su carrito (clave .anon): la regla de
  // login (§5 de roles) lo funde en el cubo propio de la cuenta que entra.
  const claveAlmacen = uid ? `${STORAGE_KEYS.carritos}.${uid}` : `${STORAGE_KEYS.carritos}.anon`;

  // Líneas VISIBLES: derivadas del cubo activo (cliente seleccionado o propio).
  // No hay useState para `lineas`: el cubo activo manda y así el cambio de
  // cliente muestra inmediatamente su borrador (vacío si no tiene).
  const claveActiva = clienteObjetivoId ?? CLAVE_PROPIA;
  const lineas = carritos[claveActiva] ?? [];

  // Proveedor del carrito activo: se DERIVA de CUALQUIER línea con proveedor
  // del cubo (no solo de la primera: los borradores antiguos pueden empezar
  // con líneas sin proveedor). Un pedido no puede mezclar proveedores, así
  // que una sola línea con proveedor define el proveedor efectivo.
  const proveedorDelCarrito = React.useMemo(() => {
    const lineaConProveedor = lineas.find(
      (l): l is LineaSolicitud & { proveedor_id: string } => Boolean(l.proveedor_id)
    );
    if (!lineaConProveedor) return null;
    return { id: lineaConProveedor.proveedor_id, nombre: lineaConProveedor.proveedor_nombre ?? 'Proveedor' };
  }, [lineas]);

  // Aviso global del carrito (p. ej. "no mezclar proveedores"). Se auto-limpia
  // a los ~5s; el timer vive en un ref y se reinicia en cada nuevo aviso.
  const [aviso, setAviso] = React.useState<string | null>(null);
  const avisoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiarAviso = React.useCallback(() => {
    setAviso(null);
    if (avisoTimer.current) {
      clearTimeout(avisoTimer.current);
      avisoTimer.current = null;
    }
  }, []);

  const mostrarAviso = React.useCallback((texto: string) => {
    setAviso(texto);
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAviso(null), 5000);
  }, []);

  // Limpieza del timer al desmontar el proveedor.
  React.useEffect(
    () => () => {
      if (avisoTimer.current) clearTimeout(avisoTimer.current);
    },
    []
  );

  // Generación de hidratación: invalida lecturas asíncronas obsoletas cuando
  // cambia la cuenta (un cambio de sesión rápido no debe restaurar el estado
  // de la cuenta anterior). uidHidratado registra a qué cuenta corresponde el
  // estado cargado, para que la persistencia no escriba datos ajenos.
  const hidratacionId = React.useRef(0);
  const uidHidratado = React.useRef<string | null>(null);
  // Si la LECTURA falla, la persistencia queda deshabilitada: escribir el
  // carrito vacío en memoria sobrescribiría los borradores guardados. Se
  // rehabilita cuando el usuario inicia explícitamente un carrito nuevo.
  const lecturaFallida = React.useRef(false);
  // Fusión del carrito anónimo al iniciar sesión (ARQUITECTURA_ROLES §5):
  // uidAnterior detecta la transición anónimo → cuenta y anonimoPendiente
  // guarda las líneas del catálogo general antes del reset de hidratación.
  const uidAnterior = React.useRef<string | null>(null);
  const anonimoPendiente = React.useRef<LineaSolicitud[]>([]);
  // Regla de carrito en login aplicada (una vez por cuenta, sin bucles).
  const reglaLoginAplicada = React.useRef<string | null>(null);
  // Espejo síncrono de `carritos` para leer su valor justo ANTES del reset de
  // hidratación (el effect de hidratación solo se re-suscribe cuando cambia
  // la cuenta; no conviene añadir `carritos` a sus dependencias).
  const carritosRef = React.useRef<Record<string, LineaSolicitud[]>>({});
  carritosRef.current = carritos;

  // Hidratación desde el almacenamiento de LA CUENTA ACTIVA. Al cambiar de
  // usuario se parte de cubos vacíos (sin mezclar borradores entre cuentas),
  // salvo el carrito del anónimo, que se funde en el cubo propio de la cuenta
  // entrante (la regla de login decidirá después si se conserva o se vacía).
  // El dato legado plano (STORAGE_KEYS.solicitud) NO se migra automáticamente:
  // no tiene dueño verificable y adoptarlo podría entregar un carrito ajeno a
  // la primera cuenta que inicie sesión en un dispositivo compartido.
  React.useEffect(() => {
    const idActual = ++hidratacionId.current;
    const uidDeLectura = uid;
    const claveDeLectura = claveAlmacen;
    // Transición anónimo → cuenta: se captura el carrito del catálogo general
    // (cubo propia en memoria) antes de resetear el estado.
    const veniaDeAnonimo = uidAnterior.current === null && uidDeLectura !== null;
    uidAnterior.current = uidDeLectura;
    anonimoPendiente.current = veniaDeAnonimo ? (carritosRef.current[CLAVE_PROPIA] ?? []) : [];
    uidHidratado.current = null;
    setHidratado(false);
    setCarritos({});
    setClienteObjetivoId(null);
    void (async () => {
      let falloLectura = false;
      try {
        const guardado = await AsyncStorage.getItem(claveDeLectura);
        if (idActual !== hidratacionId.current) return;
        const saneados: Record<string, LineaSolicitud[]> = {};
        if (guardado) {
          const datos: unknown = JSON.parse(guardado);
          const esObjeto = typeof datos === 'object' && datos !== null && !Array.isArray(datos);
          const crudos = esObjeto ? (datos as { carritos?: unknown }).carritos : null;
          // Solo se conservan los cubos cuyo valor es un array de líneas.
          if (typeof crudos === 'object' && crudos !== null && !Array.isArray(crudos)) {
            for (const [cubo, lineas] of Object.entries(crudos)) {
              if (Array.isArray(lineas)) saneados[cubo] = lineas;
            }
          }
          const idObjetivo = esObjeto
            ? (datos as { clienteObjetivoId?: unknown }).clienteObjetivoId
            : null;
          setClienteObjetivoId(typeof idObjetivo === 'string' ? idObjetivo : null);
        }
        // Fusión del carrito anónimo en el cubo propio de la cuenta entrante
        // (sumando cantidades si el producto ya estaba). La regla de login
        // decidirá si el resultado se conserva (comercial por defecto) o se
        // vacía (proveedor no visible para el comercial del cliente).
        const anonimas = anonimoPendiente.current;
        if (anonimas.length > 0) {
          anonimoPendiente.current = [];
          const combinado = new Map<string, LineaSolicitud>();
          for (const l of saneados[CLAVE_PROPIA] ?? []) combinado.set(l.producto_id, { ...l });
          for (const l of anonimas) {
            const previo = combinado.get(l.producto_id);
            if (previo) previo.cantidad = Math.min(999, previo.cantidad + l.cantidad);
            else combinado.set(l.producto_id, { ...l });
          }
          saneados[CLAVE_PROPIA] = Array.from(combinado.values());
          // El carrito anónimo ya se fundió: su clave queda obsoleta.
          void AsyncStorage.removeItem(`${STORAGE_KEYS.carritos}.anon`).catch(() => {});
        }
        setCarritos(saneados);
      } catch {
        // Lectura fallida: NO se marca como hidratado; la persistencia queda
        // deshabilitada para no sobrescribir los borradores guardados.
        falloLectura = true;
      }
      if (idActual !== hidratacionId.current) return;
      lecturaFallida.current = falloLectura;
      uidHidratado.current = uidDeLectura;
      setHidratado(!falloLectura);
    })();
  }, [uid, claveAlmacen]);

  // Persistencia en cada cambio (todos los cubos + cliente activo) en la
  // clave de la cuenta activa. Solo escribe cuando el estado hidratado
  // pertenece a la cuenta actual (evita guardar el carrito de la cuenta
  // anterior bajo la clave de la nueva) y cuando la lectura inicial no falló.
  React.useEffect(() => {
    if (!hidratado || !claveAlmacen || uidHidratado.current !== uid || lecturaFallida.current) {
      return;
    }
    void (async () => {
      try {
        await AsyncStorage.setItem(
          claveAlmacen,
          JSON.stringify({ carritos, clienteObjetivoId } satisfies EstadoPersistido)
        );
      } catch (error) {
        console.warn('No se pudo persistir la solicitud en el dispositivo', error);
      }
    })();
  }, [carritos, clienteObjetivoId, hidratado, claveAlmacen, uid]);

  // Regla de carrito al iniciar sesión (ARQUITECTURA_ROLES §5): SOLO clientes
  // y UNA vez por cuenta. Con el cubo propio hidratado y con líneas:
  //  - sin comercial asignado → fn_asignar_comercial_defecto() + refresco del
  //    perfil; el carrito se CONSERVA (el comercial por defecto es el del
  //    catálogo general, cuyos proveedores son justo los del carrito);
  //  - con comercial → si el proveedor del carrito NO está entre los visibles
  //    para el cliente, se vacía el cubo propio con aviso.
  // Si la red falla el carrito se conserva: el servidor validará al enviar.
  React.useEffect(() => {
    if (!uid || perfil?.rol !== 'cliente' || !hidratado) return;
    if (reglaLoginAplicada.current === uid) return; // evita bucles (una vez)
    const propio = carritos[CLAVE_PROPIA] ?? [];
    if (propio.length === 0) return;
    void (async () => {
      reglaLoginAplicada.current = uid;
      try {
        if (perfil.id_comercial == null) {
          await supabase.rpc('fn_asignar_comercial_defecto');
          await refreshPerfil();
          return; // carrito conservado
        }
        const { data } = await supabase.rpc('fn_proveedores_visibles');
        const visibles = ((data ?? []) as { id: string }[]).map((p) => p.id);
        const lineaConProveedor = propio.find((l) => Boolean(l.proveedor_id));
        if (lineaConProveedor?.proveedor_id && !visibles.includes(lineaConProveedor.proveedor_id)) {
          setCarritos((previos) => ({ ...previos, [CLAVE_PROPIA]: [] }));
          mostrarAviso(
            'Tu carrito era del catálogo general y tu comercial no incluye ese proveedor; se ha vaciado.'
          );
        }
      } catch {
        // sin red: se conserva el carrito; el servidor validará al enviar
      }
    })();
  }, [uid, perfil, hidratado, carritos, mostrarAviso, refreshPerfil]);

  // Todas las mutaciones operan SOLO sobre el cubo activo (cliente
  // seleccionado o carrito propio), nunca sobre los demás borradores.
  const anadir = React.useCallback(
    (linea: LineaSolicitud) => {
      // El admin no usa carrito propio: SOLO puede añadir cuando prepara el
      // borrador de un cliente (clienteObjetivoId fijado). Sin cliente
      // objetivo se rechaza con aviso (la UI ya oculta los botones).
      if (perfil?.rol === 'admin' && !clienteObjetivoId) {
        mostrarAviso(
          'El administrador no tiene carrito propio: selecciona un cliente para preparar su pedido.'
        );
        return;
      }
      // Acción explícita de nuevo carrito: rehabilita la persistencia si la
      // lectura inicial había fallado.
      if (lecturaFallida.current) {
        lecturaFallida.current = false;
        setHidratado(true);
      }
      // Proveedor único por carrito: si CUALQUIER línea del cubo activo tiene
      // proveedor y la nueva trae OTRO proveedor, la adición se rechaza y se
      // muestra un aviso visible (el servidor valida la misma regla al crear
      // el pedido). Casos permitidos: cubo vacío, nueva línea sin proveedor
      // (no desempareja), o proveedor coincidente → se añade y se limpia el
      // aviso previo.
      const lineaConProveedor = lineas.find((l) => Boolean(l.proveedor_id));
      if (
        lineaConProveedor?.proveedor_id &&
        linea.proveedor_id &&
        linea.proveedor_id !== lineaConProveedor.proveedor_id
      ) {
        mostrarAviso(
          `No puedes mezclar proveedores en un pedido (carrito actual: ${
            lineaConProveedor.proveedor_nombre ?? 'Proveedor'
          }). Vacía el carrito o crea un pedido para este cliente.`
        );
        return;
      }
      limpiarAviso();
      setCarritos((previos) => {
        const clave = clienteObjetivoId ?? CLAVE_PROPIA;
        const actuales = previos[clave] ?? [];
        const existente = actuales.find((l) => l.producto_id === linea.producto_id);
        const nuevas = existente
          ? actuales.map((l) =>
              l.producto_id === linea.producto_id
                ? { ...l, cantidad: Math.min(l.cantidad + linea.cantidad, 999) }
                : l
            )
          : [...actuales, linea];
        return { ...previos, [clave]: nuevas };
      });
    },
    [clienteObjetivoId, lineas, mostrarAviso, limpiarAviso, perfil?.rol]
  );

  const quitar = React.useCallback(
    (productoId: string) => {
      setCarritos((previos) => {
        const clave = clienteObjetivoId ?? CLAVE_PROPIA;
        return {
          ...previos,
          [clave]: (previos[clave] ?? []).filter((l) => l.producto_id !== productoId),
        };
      });
    },
    [clienteObjetivoId]
  );

  const cambiarCantidad = React.useCallback(
    (productoId: string, delta: number) => {
      setCarritos((previos) => {
        const clave = clienteObjetivoId ?? CLAVE_PROPIA;
        return {
          ...previos,
          [clave]: (previos[clave] ?? [])
            .map((l) =>
              l.producto_id === productoId
                ? { ...l, cantidad: Math.min(999, Math.max(0, l.cantidad + delta)) }
                : l
            )
            .filter((l) => l.cantidad > 0),
        };
      });
    },
    [clienteObjetivoId]
  );

  const reemplazar = React.useCallback(
    (nuevas: LineaSolicitud[]) => {
      setCarritos((previos) => {
        const clave = clienteObjetivoId ?? CLAVE_PROPIA;
        return { ...previos, [clave]: nuevas };
      });
    },
    [clienteObjetivoId]
  );

  // Limpia SOLO el cubo activo: tras enviar un pedido se vacía el borrador de
  // ese cliente (o el carrito propio) y los demás borradores se conservan.
  const vaciar = React.useCallback(() => {
    setCarritos((previos) => {
      const clave = clienteObjetivoId ?? CLAVE_PROPIA;
      return { ...previos, [clave]: [] };
    });
  }, [clienteObjetivoId]);

  const total = React.useMemo(
    () => lineas.reduce((acc, l) => acc + l.precio_final * l.cantidad, 0),
    [lineas]
  );

  const value = React.useMemo(
    () => ({
      lineas,
      clienteObjetivoId,
      setClienteObjetivoId,
      anadir,
      quitar,
      cambiarCantidad,
      reemplazar,
      vaciar,
      total,
      proveedorDelCarrito,
      aviso,
      limpiarAviso,
    }),
    [lineas, clienteObjetivoId, anadir, quitar, cambiarCantidad, reemplazar, vaciar, total, proveedorDelCarrito, aviso, limpiarAviso]
  );

  return <SolicitudContext.Provider value={value}>{children}</SolicitudContext.Provider>;
}

export function useSolicitud(): SolicitudContextValue {
  const ctx = React.useContext(SolicitudContext);
  if (!ctx) throw new Error('useSolicitud debe usarse dentro de <SolicitudProvider>');
  return ctx;
}
