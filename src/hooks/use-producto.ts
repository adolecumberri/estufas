import * as React from 'react';

import { useAuth } from '@/hooks/use-auth';
import { cacheEscribir, cacheLeer } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import type { ProductoDetalle } from '@/lib/types';

// La clave incluye la cuenta (y el cliente objetivo): el precio de la ficha
// se personaliza por usuario en el servidor.
const claveProducto = (uid: string | null, clienteId: string | null | undefined, id: string) =>
  `estufas.cache.producto.v1:${uid ?? 'anon'}:${clienteId ?? 'anon'}:${id}`;

// Ficha de producto (RPC fn_producto_detalle: precio efectivo + características + galería).
export function useProducto(id: string | undefined, clienteId?: string | null) {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;

  const [productoBruto, setProducto] = React.useState<ProductoDetalle | null>(null);
  // Clave (cuenta/cliente/producto) a la que pertenece el resultado mostrado.
  // Mientras no coincida con la petición actual, no se muestra nada: evita
  // pintar el precio de la identidad anterior durante una transición.
  const [claveMostrada, setClaveMostrada] = React.useState<string | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const claveActual = id ? claveProducto(uid, clienteId, id) : null;
  const producto = claveActual !== null && claveMostrada === claveActual ? productoBruto : null;
  const mostrandoCarga = cargando || (claveActual !== null && claveMostrada !== claveActual);

  React.useEffect(() => {
    if (!id) {
      setCargando(false);
      setClaveMostrada(null);
      return;
    }
    const claveDeLectura = claveProducto(uid, clienteId, id);
    let cancelado = false;
    // Si la red responde antes que la caché, la caché NO debe pisar la ficha
    // fresca (carrera caché-vs-red).
    let aplicadoRed = false;
    setError(null);
    setCargando(true);

    // Caché (stale-while-revalidate): si hay ficha guardada se pinta al
    // instante sin spinner; la red se ejecuta siempre y revalida en segundo
    // plano. Sin caché, se mantiene el comportamiento actual (spinner).
    void (async () => {
      const enCache = await cacheLeer<ProductoDetalle>(claveDeLectura);
      if (cancelado || aplicadoRed) return;
      if (enCache) {
        setProducto(enCache);
        setClaveMostrada(claveDeLectura);
        setCargando(false);
      }
    })();

    void (async () => {
      const { data, error } = await supabase.rpc('fn_producto_detalle', {
        p_producto: id,
        p_cliente: clienteId ?? null,
      });
      if (cancelado) return;
      if (error) {
        setError(error.message);
        setProducto(null);
        setClaveMostrada(claveDeLectura);
        setCargando(false);
        return;
      }
      const fila = (data ?? [])[0] as ProductoDetalle | undefined;
      aplicadoRed = true;
      setProducto(fila ?? null);
      setClaveMostrada(claveDeLectura);
      setCargando(false);
      if (fila) void cacheEscribir(claveDeLectura, fila);
    })();

    return () => {
      cancelado = true;
    };
  }, [id, clienteId, uid]);

  return { producto, cargando: mostrandoCarga, error };
}
