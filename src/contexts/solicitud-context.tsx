import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

import { STORAGE_KEYS } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
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
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  const claveAlmacen = uid ? `${STORAGE_KEYS.carritos}.${uid}` : null;

  // Líneas VISIBLES: derivadas del cubo activo (cliente seleccionado o propio).
  // No hay useState para `lineas`: el cubo activo manda y así el cambio de
  // cliente muestra inmediatamente su borrador (vacío si no tiene).
  const claveActiva = clienteObjetivoId ?? CLAVE_PROPIA;
  const lineas = carritos[claveActiva] ?? [];

  // Generación de hidratación: invalida lecturas asíncronas obsoletas cuando
  // cambia la cuenta (un cambio de sesión rápido no debe restaurar el estado
  // de la cuenta anterior). uidHidratado registra a qué cuenta corresponde el
  // estado cargado, para que la persistencia no escriba datos ajenos.
  const hidratacionId = React.useRef(0);
  const uidHidratado = React.useRef<string | null>(null);

  // Hidratación desde el almacenamiento de LA CUENTA ACTIVA. Al cambiar de
  // usuario se parte de cubos vacíos (sin mezclar borradores entre cuentas).
  // El dato legado plano (STORAGE_KEYS.solicitud) NO se migra automáticamente:
  // no tiene dueño verificable y adoptarlo podría entregar un carrito ajeno a
  // la primera cuenta que inicie sesión en un dispositivo compartido.
  React.useEffect(() => {
    const idActual = ++hidratacionId.current;
    const uidDeLectura = uid;
    const claveDeLectura = claveAlmacen;
    uidHidratado.current = null;
    setHidratado(false);
    setCarritos({});
    setClienteObjetivoId(null);
    if (!uidDeLectura || !claveDeLectura) {
      uidHidratado.current = uidDeLectura;
      setHidratado(true);
      return;
    }
    void (async () => {
      try {
        const guardado = await AsyncStorage.getItem(claveDeLectura);
        if (idActual !== hidratacionId.current) return;
        if (guardado) {
          const datos: unknown = JSON.parse(guardado);
          const esObjeto = typeof datos === 'object' && datos !== null && !Array.isArray(datos);
          const crudos = esObjeto ? (datos as { carritos?: unknown }).carritos : null;
          // Solo se conservan los cubos cuyo valor es un array de líneas.
          const saneados: Record<string, LineaSolicitud[]> = {};
          if (typeof crudos === 'object' && crudos !== null && !Array.isArray(crudos)) {
            for (const [cubo, lineas] of Object.entries(crudos)) {
              if (Array.isArray(lineas)) saneados[cubo] = lineas;
            }
          }
          setCarritos(saneados);
          const idObjetivo = esObjeto
            ? (datos as { clienteObjetivoId?: unknown }).clienteObjetivoId
            : null;
          setClienteObjetivoId(typeof idObjetivo === 'string' ? idObjetivo : null);
        }
      } catch {
        // almacenamiento no disponible: se empieza con los cubos vacíos
      }
      if (idActual !== hidratacionId.current) return;
      uidHidratado.current = uidDeLectura;
      setHidratado(true);
    })();
  }, [uid, claveAlmacen]);

  // Persistencia en cada cambio (todos los cubos + cliente activo) en la
  // clave de la cuenta activa. Solo escribe cuando el estado hidratado
  // pertenece a la cuenta actual (evita guardar el carrito de la cuenta
  // anterior bajo la clave de la nueva).
  React.useEffect(() => {
    if (!hidratado || !claveAlmacen || uidHidratado.current !== uid) return;
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

  // Todas las mutaciones operan SOLO sobre el cubo activo (cliente
  // seleccionado o carrito propio), nunca sobre los demás borradores.
  const anadir = React.useCallback(
    (linea: LineaSolicitud) => {
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
    [clienteObjetivoId]
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
    () => ({ lineas, clienteObjetivoId, setClienteObjetivoId, anadir, quitar, cambiarCantidad, reemplazar, vaciar, total }),
    [lineas, clienteObjetivoId, anadir, quitar, cambiarCantidad, reemplazar, vaciar, total]
  );

  return <SolicitudContext.Provider value={value}>{children}</SolicitudContext.Provider>;
}

export function useSolicitud(): SolicitudContextValue {
  const ctx = React.useContext(SolicitudContext);
  if (!ctx) throw new Error('useSolicitud debe usarse dentro de <SolicitudProvider>');
  return ctx;
}
