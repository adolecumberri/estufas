import * as React from 'react';

import { supabase } from '@/lib/supabase';
import type { ProductoDetalle } from '@/lib/types';

// Ficha de producto (RPC fn_producto_detalle: precio efectivo + características + galería).
export function useProducto(id: string | undefined, clienteId?: string | null) {
  const [producto, setProducto] = React.useState<ProductoDetalle | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) {
      setCargando(false);
      return;
    }
    let cancelado = false;
    setCargando(true);
    setError(null);

    void (async () => {
      const { data, error } = await supabase.rpc('fn_producto_detalle', {
        p_producto: id,
        p_cliente: clienteId ?? null,
      });
      if (cancelado) return;
      if (error) {
        setError(error.message);
        setCargando(false);
        return;
      }
      const fila = (data ?? [])[0] as ProductoDetalle | undefined;
      setProducto(fila ?? null);
      setCargando(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [id, clienteId]);

  return { producto, cargando, error };
}
