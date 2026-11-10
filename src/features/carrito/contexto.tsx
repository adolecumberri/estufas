import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

import { useAuth } from '@/features/auth/use-auth';
import { supabase } from '@/shared/lib/supabase';
import type { LineaSolicitud } from '@/shared/lib/types';

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
  // Proveedor del carrito (derivado de su primera línea con proveedor).
  proveedorDelCarrito: { id: string; nombre: string } | null;
  // Aviso global (p. ej. intento de mezclar proveedores) y su cierre manual.
  aviso: string | null;
  limpiarAviso: () => void;
}

const SolicitudContext = React.createContext<SolicitudContextValue | null>(null);

// ============================================================================
// Modelo 10/11/2026 (feedback del usuario): UN SOLO CARRITO POR CUENTA.
//   - `lineas`: la única lista de líneas de la cuenta (o del anónimo).
//   - `clienteObjetivoId`: a quién se ASIGNARÁ el pedido. Asignar/cliente NO
//     mueve ni vacía el carrito.
//   - Persistencia: una clave por cuenta (`estufas.carrito.v1.<uid|anon>`).
//   - Vaciar vacía ESE carrito y se persiste como vacío (no hay otros cubos
//     de los que puedan reaparecer valores).
// Las claves LEGACY (cubos por cliente `estufas.carritos.v2.*` y el plano
// `estufas.solicitud`) se migran UNA VEZ (cubo activo → carrito único) y se
// BORRAN para que los valores viejos no reaparezcan al volver a la pantalla.
// ============================================================================

const CLAVE_CARRITO = 'estufas.carrito.v1';
const CLAVE_CUBOS_V2 = 'estufas.carritos.v2';
const CLAVE_PLANO_V1 = 'estufas.solicitud';

interface EstadoPersistido {
  lineas: LineaSolicitud[];
  clienteObjetivoId: string | null;
}

function sanitizarEstado(bruto: unknown): EstadoPersistido | null {
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return null;
  const d = bruto as { lineas?: unknown; clienteObjetivoId?: unknown };
  const lineas = Array.isArray(d.lineas) ? (d.lineas as LineaSolicitud[]) : [];
  const clienteObjetivoId = typeof d.clienteObjetivoId === 'string' ? d.clienteObjetivoId : null;
  return { lineas, clienteObjetivoId };
}

export function SolicitudProvider({ children }: { children: React.ReactNode }) {
  const [lineas, setLineas] = React.useState<LineaSolicitud[]>([]);
  const [clienteObjetivoId, setClienteObjetivoId] = React.useState<string | null>(null);
  const [hidratado, setHidratado] = React.useState(false);

  // Los carritos se aíslan por CUENTA: cada usuario autenticado tiene su
  // propia clave de almacenamiento; los anónimos usan la clave .anon.
  const { session, perfil, refreshPerfil } = useAuth();
  const uid = session?.user?.id ?? null;
  const claveAlmacen = `${CLAVE_CARRITO}.${uid ?? 'anon'}`;

  // Proveedor del carrito: se DERIVA de CUALQUIER línea con proveedor (no solo
  // de la primera: los datos antiguos pueden empezar con líneas sin proveedor).
  const proveedorDelCarrito = React.useMemo(() => {
    const lineaConProveedor = lineas.find((l): l is LineaSolicitud & { proveedor_id: string } =>
      Boolean(l.proveedor_id)
    );
    if (!lineaConProveedor) return null;
    return {
      id: lineaConProveedor.proveedor_id,
      nombre: lineaConProveedor.proveedor_nombre ?? 'Proveedor',
    };
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

  React.useEffect(
    () => () => {
      if (avisoTimer.current) clearTimeout(avisoTimer.current);
    },
    []
  );

  // Generación de hidratación: invalida lecturas asíncronas obsoletas cuando
  // cambia la cuenta. uidHidratado registra a qué cuenta corresponde el estado
  // cargado para que la persistencia no escriba datos ajenos.
  const hidratacionId = React.useRef(0);
  const uidHidratado = React.useRef<string | null>(null);
  // Si la LECTURA falla, la persistencia queda deshabilitada: escribir el
  // carrito vacío en memoria sobrescribiría lo guardado.
  const lecturaFallida = React.useRef(false);
  // Fusión del carrito anónimo al iniciar sesión (ARQUITECTURA_ROLES §5).
  const uidAnterior = React.useRef<string | null>(null);
  const anonimoPendiente = React.useRef<LineaSolicitud[]>([]);
  // Regla de carrito en login aplicada (una vez por cuenta, sin bucles).
  const reglaLoginAplicada = React.useRef<string | null>(null);
  // Espejo síncrono de `lineas` para leer su valor justo ANTES del reset de
  // hidratación.
  const lineasRef = React.useRef<LineaSolicitud[]>([]);
  lineasRef.current = lineas;

  // Hidratación del carrito ÚNICO de la cuenta activa. Al cambiar de usuario
  // se parte de carrito vacío (sin mezclar datos entre cuentas), salvo el
  // carrito del anónimo, que se funde en el de la cuenta entrante.
  React.useEffect(() => {
    const idActual = ++hidratacionId.current;
    const uidDeLectura = uid;
    const claveDeLectura = claveAlmacen;
    // Transición anónimo → cuenta: se captura el carrito anónimo en memoria.
    const veniaDeAnonimo = uidAnterior.current === null && uidDeLectura !== null;
    uidAnterior.current = uidDeLectura;
    anonimoPendiente.current = veniaDeAnonimo ? lineasRef.current : [];
    uidHidratado.current = null;
    setHidratado(false);
    setLineas([]);
    setClienteObjetivoId(null);
    void (async () => {
      let falloLectura = false;
      try {
        let datos: EstadoPersistido | null = null;

        // 1) Clave actual (modelo de carrito único).
        const nuevo = await AsyncStorage.getItem(claveDeLectura);
        if (nuevo) datos = sanitizarEstado(JSON.parse(nuevo));
        if (idActual !== hidratacionId.current) return;

        // 2) Migración ONE-TIME desde los cubos v2 (cubo activo → carrito).
        if (!datos) {
          const cuboLegado = uidDeLectura
            ? `${CLAVE_CUBOS_V2}.${uidDeLectura}`
            : `${CLAVE_CUBOS_V2}.anon`;
          const legado = await AsyncStorage.getItem(cuboLegado);
          if (legado) {
            const parsed = JSON.parse(legado) as {
              carritos?: Record<string, LineaSolicitud[]>;
              clienteObjetivoId?: unknown;
            };
            const objetivo =
              typeof parsed.clienteObjetivoId === 'string' ? parsed.clienteObjetivoId : null;
            const cubos = parsed.carritos ?? {};
            const lista =
              (objetivo && Array.isArray(cubos[objetivo]) && cubos[objetivo].length > 0
                ? cubos[objetivo]
                : cubos['propia']) ?? [];
            datos = {
              lineas: Array.isArray(lista) ? lista : [],
              clienteObjetivoId: objetivo,
            };
          }
        }

        // 3) Borrado de claves legacy (v1 plano y cubos v2): los valores
        //    viejos no deben reaparecer al volver a la pantalla.
        await Promise.all(
          [
            AsyncStorage.removeItem(`${CLAVE_CUBOS_V2}.${uidDeLectura ?? 'anon'}`),
            AsyncStorage.removeItem(`${CLAVE_CUBOS_V2}.anon`),
            AsyncStorage.removeItem(CLAVE_PLANO_V1),
          ].map((p) => p.catch(() => {}))
        );
        if (idActual !== hidratacionId.current) return;

        // 4) Fusión del carrito anónimo en el de la cuenta entrante (sumando
        //    cantidades si el producto ya estaba).
        const anonimas = anonimoPendiente.current;
        if (anonimas.length > 0) {
          anonimoPendiente.current = [];
          const combinado = new Map<string, LineaSolicitud>();
          for (const l of datos?.lineas ?? []) combinado.set(l.producto_id, { ...l });
          for (const l of anonimas) {
            const previo = combinado.get(l.producto_id);
            if (previo) previo.cantidad = Math.min(999, previo.cantidad + l.cantidad);
            else combinado.set(l.producto_id, { ...l });
          }
          datos = {
            lineas: Array.from(combinado.values()),
            clienteObjetivoId: datos?.clienteObjetivoId ?? null,
          };
        }

        setClienteObjetivoId(datos?.clienteObjetivoId ?? null);
        setLineas(datos?.lineas ?? []);
      } catch {
        falloLectura = true;
      }
      if (idActual !== hidratacionId.current) return;
      lecturaFallida.current = falloLectura;
      uidHidratado.current = uidDeLectura;
      setHidratado(!falloLectura);
    })();
  }, [uid, claveAlmacen]);

  // Persistencia en cada cambio (carrito único + cliente objetivo) en la clave
  // de la cuenta activa. Solo escribe cuando el estado hidratado pertenece a
  // la cuenta actual y cuando la lectura inicial no falló.
  React.useEffect(() => {
    if (!hidratado || !claveAlmacen || uidHidratado.current !== uid || lecturaFallida.current) {
      return;
    }
    void (async () => {
      try {
        await AsyncStorage.setItem(
          claveAlmacen,
          JSON.stringify({ lineas, clienteObjetivoId } satisfies EstadoPersistido)
        );
      } catch (error) {
        console.warn('No se pudo persistir la solicitud en el dispositivo', error);
      }
    })();
  }, [lineas, clienteObjetivoId, hidratado, claveAlmacen, uid]);

  // Regla de carrito al iniciar sesión (ARQUITECTURA_ROLES §5): SOLO clientes
  // y UNA vez por cuenta. Con el carrito hidratado y con líneas:
  //  - sin comercial asignado → fn_asignar_comercial_defecto() + refresco del
  //    perfil; el carrito se CONSERVA;
  //  - con comercial → si el proveedor del carrito NO está entre los visibles
  //    para el cliente, se vacía con aviso.
  // Si la red falla el carrito se conserva: el servidor validará al enviar.
  React.useEffect(() => {
    if (!uid || perfil?.rol !== 'cliente' || !hidratado) return;
    if (reglaLoginAplicada.current === uid) return;
    if (lineas.length === 0) return;
    void (async () => {
      reglaLoginAplicada.current = uid;
      try {
        if (perfil.id_comercial == null) {
          await supabase.rpc('fn_asignar_comercial_defecto');
          await refreshPerfil();
          return;
        }
        const { data } = await supabase.rpc('fn_proveedores_visibles');
        const visibles = ((data ?? []) as { id: string }[]).map((p) => p.id);
        const lineaConProveedor = lineas.find((l) => Boolean(l.proveedor_id));
        if (lineaConProveedor?.proveedor_id && !visibles.includes(lineaConProveedor.proveedor_id)) {
          setLineas([]);
          mostrarAviso(
            'Tu carrito era del catálogo general y tu comercial no incluye ese proveedor; se ha vaciado.'
          );
        }
      } catch {
        // sin red: se conserva el carrito; el servidor validará al enviar
      }
    })();
  }, [uid, perfil, hidratado, lineas, mostrarAviso, refreshPerfil]);

  // Mutaciones: todas operan sobre EL carrito único. Asignar un cliente
  // (setClienteObjetivoId) NO toca las líneas.
  const anadir = React.useCallback(
    (linea: LineaSolicitud) => {
      // El admin no usa carrito propio: SOLO puede añadir cuando prepara el
      // pedido de un cliente (clienteObjetivoId fijado).
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
      // Proveedor único por carrito: si CUALQUIER línea tiene proveedor y la
      // nueva trae OTRO proveedor, la adición se rechaza con aviso (el
      // servidor valida la misma regla al crear el pedido).
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
      setLineas((actuales) => {
        const existente = actuales.find((l) => l.producto_id === linea.producto_id);
        return existente
          ? actuales.map((l) =>
              l.producto_id === linea.producto_id
                ? { ...l, cantidad: Math.min(l.cantidad + linea.cantidad, 999) }
                : l
            )
          : [...actuales, linea];
      });
    },
    [clienteObjetivoId, lineas, mostrarAviso, limpiarAviso, perfil?.rol]
  );

  const quitar = React.useCallback((productoId: string) => {
    setLineas((actuales) => actuales.filter((l) => l.producto_id !== productoId));
  }, []);

  const cambiarCantidad = React.useCallback((productoId: string, delta: number) => {
    setLineas((actuales) =>
      actuales
        .map((l) =>
          l.producto_id === productoId
            ? { ...l, cantidad: Math.min(999, Math.max(0, l.cantidad + delta)) }
            : l
        )
        .filter((l) => l.cantidad > 0)
    );
  }, []);

  const reemplazar = React.useCallback((nuevas: LineaSolicitud[]) => {
    setLineas(nuevas);
  }, []);

  // Vacía EL carrito único (y la persistencia refleja el vacío: no hay otros
  // cubos de los que puedan reaparecer valores al volver).
  const vaciar = React.useCallback(() => {
    setLineas([]);
  }, []);

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
    [
      lineas,
      clienteObjetivoId,
      anadir,
      quitar,
      cambiarCantidad,
      reemplazar,
      vaciar,
      total,
      proveedorDelCarrito,
      aviso,
      limpiarAviso,
    ]
  );

  return <SolicitudContext.Provider value={value}>{children}</SolicitudContext.Provider>;
}

export function useSolicitud(): SolicitudContextValue {
  const ctx = React.useContext(SolicitudContext);
  if (!ctx) throw new Error('useSolicitud debe usarse dentro de <SolicitudProvider>');
  return ctx;
}
