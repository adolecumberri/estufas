import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

import { STORAGE_KEYS } from '@/constants';
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

  // Líneas VISIBLES: derivadas del cubo activo (cliente seleccionado o propio).
  // No hay useState para `lineas`: el cubo activo manda y así el cambio de
  // cliente muestra inmediatamente su borrador (vacío si no tiene).
  const claveActiva = clienteObjetivoId ?? CLAVE_PROPIA;
  const lineas = carritos[claveActiva] ?? [];

  // Hidratación desde el almacenamiento. Si existe el formato nuevo
  // (carritos por cliente) se usa; si solo existe el dato legado
  // (STORAGE_KEYS.solicitud, carrito plano) se migra al cubo propio.
  React.useEffect(() => {
    void (async () => {
      try {
        const guardado = await AsyncStorage.getItem(STORAGE_KEYS.carritos);
        if (guardado) {
          const datos = JSON.parse(guardado) as Partial<EstadoPersistido>;
          setCarritos(datos.carritos ?? {});
          setClienteObjetivoId(datos.clienteObjetivoId ?? null);
        } else {
          const legado = await AsyncStorage.getItem(STORAGE_KEYS.solicitud);
          if (legado) {
            const lineasLegado = JSON.parse(legado) as LineaSolicitud[];
            if (Array.isArray(lineasLegado)) {
              setCarritos({ [CLAVE_PROPIA]: lineasLegado });
            }
            await AsyncStorage.removeItem(STORAGE_KEYS.solicitud);
          }
        }
      } catch {
        // almacenamiento no disponible: se empieza con los cubos vacíos
      }
      setHidratado(true);
    })();
  }, []);

  // Persistencia en cada cambio (todos los cubos + cliente activo).
  React.useEffect(() => {
    if (!hidratado) return;
    void AsyncStorage.setItem(
      STORAGE_KEYS.carritos,
      JSON.stringify({ carritos, clienteObjetivoId } satisfies EstadoPersistido)
    );
  }, [carritos, clienteObjetivoId, hidratado]);

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
