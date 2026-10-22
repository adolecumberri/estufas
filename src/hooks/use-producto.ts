import * as React from 'react';

import { useAuth } from '@/hooks/use-auth';
import { cacheEscribir, cacheLeer } from '@/lib/cache';
import {
  filaAProductoDetalle,
  inicializarBd,
  obtenerProducto,
  sincronizarCatalogo,
} from '@/lib/catalogo-local';
import { obtenerReglasCuenta, type ReglasCuenta } from '@/lib/precios';
import { supabase } from '@/lib/supabase';
import type { ProductoDetalle } from '@/lib/types';

// La clave incluye la cuenta (y el cliente objetivo): el precio de la ficha
// se personaliza por usuario.
const claveProducto = (uid: string | null, clienteId: string | null | undefined, id: string) =>
  `estufas.cache.producto.v1:${uid ?? 'anon'}:${clienteId ?? 'anon'}:${id}`;

// Ficha de producto servida desde SQLite local (con refresco del snapshot si
// la versión cambió) y fallback al RPC fn_producto_detalle anterior cuando no
// hay SQLite o el producto no está en el snapshot. La API pública no cambia.
export function useProducto(id: string | undefined, clienteId?: string | null) {
  const { session, perfil } = useAuth();
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
    // fresca (carrera caché-vs-red, camino de red).
    let aplicadoRed = false;
    setError(null);
    setCargando(true);

    void (async () => {
      // 1) Camino local: sincroniza la versión (descarga el snapshot solo si
      // cambió) y lee la fila. La visibilidad por proveedor se replica aquí:
      // anónimo y admin sin cliente objetivo ven todo; el resto, los
      // productos sin proveedor o con proveedor habilitado en sus reglas.
      let modoLocal = true;
      try {
        inicializarBd();
      } catch {
        modoLocal = false;
      }

      if (modoLocal) {
        try {
          await sincronizarCatalogo();
        } catch {
          // Sin snapshot local y sin red: se intenta el camino de red, que
          // dará el mismo error si la red sigue caída.
        }
        if (cancelado) return;
        const reglas: ReglasCuenta | null = await obtenerReglasCuenta(uid, clienteId);
        const fila = obtenerProducto(id);
        if (fila) {
          const visible =
            fila.proveedor_id === null ||
            !uid ||
            (perfil?.rol === 'admin' && !clienteId) ||
            (reglas !== null && reglas.proveedores_habilitados.includes(fila.proveedor_id));
          if (!visible) {
            if (cancelado) return;
            setProducto(null);
            setClaveMostrada(claveDeLectura);
            setCargando(false);
            setError('Producto no disponible');
            return;
          }
          if (cancelado) return;
          setProducto(filaAProductoDetalle(fila, reglas));
          setClaveMostrada(claveDeLectura);
          setCargando(false);
          return;
        }
      }

      // 2) Fallback a red (sin SQLite o producto fuera del snapshot):
      // stale-while-revalidate + RPC, como el comportamiento anterior.
      void (async () => {
        const enCache = await cacheLeer<ProductoDetalle>(claveDeLectura);
        if (cancelado || aplicadoRed) return;
        if (enCache) {
          setProducto(enCache);
          setClaveMostrada(claveDeLectura);
          setCargando(false);
        }
      })();

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
  }, [id, clienteId, uid, perfil?.rol]);

  return { producto, cargando: mostrandoCarga, error };
}
