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

// Solicitud en curso (carrito de pedido). Se persiste en el dispositivo para
// tolerar reinicios de la app; el pedido real se crea con el RPC crear_pedido.
export function SolicitudProvider({ children }: { children: React.ReactNode }) {
  const [lineas, setLineas] = React.useState<LineaSolicitud[]>([]);
  const [clienteObjetivoId, setClienteObjetivoId] = React.useState<string | null>(null);
  const [hidratado, setHidratado] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      try {
        const guardado = await AsyncStorage.getItem(STORAGE_KEYS.solicitud);
        if (guardado) setLineas(JSON.parse(guardado) as LineaSolicitud[]);
      } catch {
        // almacenamiento no disponible: se empieza vacío
      }
      setHidratado(true);
    })();
  }, []);

  React.useEffect(() => {
    if (!hidratado) return;
    void AsyncStorage.setItem(STORAGE_KEYS.solicitud, JSON.stringify(lineas));
  }, [lineas, hidratado]);

  const anadir = React.useCallback((linea: LineaSolicitud) => {
    setLineas((previas) => {
      const existente = previas.find((l) => l.producto_id === linea.producto_id);
      if (existente) {
        return previas.map((l) =>
          l.producto_id === linea.producto_id
            ? { ...l, cantidad: Math.min(l.cantidad + linea.cantidad, 999) }
            : l
        );
      }
      return [...previas, linea];
    });
  }, []);

  const quitar = React.useCallback((productoId: string) => {
    setLineas((previas) => previas.filter((l) => l.producto_id !== productoId));
  }, []);

  const cambiarCantidad = React.useCallback((productoId: string, delta: number) => {
    setLineas((previas) =>
      previas
        .map((l) =>
          l.producto_id === productoId
            ? { ...l, cantidad: Math.min(999, Math.max(0, l.cantidad + delta)) }
            : l
        )
        .filter((l) => l.cantidad > 0)
    );
  }, []);

  const vaciar = React.useCallback(() => setLineas([]), []);

  const reemplazar = React.useCallback((nuevas: LineaSolicitud[]) => setLineas(nuevas), []);

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
