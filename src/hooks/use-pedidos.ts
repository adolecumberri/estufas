import * as React from 'react';

import { supabase } from '@/lib/supabase';
import type { HistorialEstado, LineaPedido, Pedido } from '@/lib/types';

// Pedidos del usuario autenticado (RLS devuelve solo los visibles por rol).
export function usePedidos() {
  const [pedidos, setPedidos] = React.useState<Pedido[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const recargar = React.useCallback(async () => {
    setCargando(true);
    setError(null);
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, pedido_lineas(*)')
      .order('fecha_pedido', { ascending: false });
    setCargando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPedidos((data ?? []) as Pedido[]);
  }, []);

  React.useEffect(() => {
    void recargar();
  }, [recargar]);

  return { pedidos, cargando, error, recargar };
}

export interface DetallePedido {
  pedido: Pedido;
  lineas: LineaPedido[];
  historial: HistorialEstado[];
}

export function usePedido(id: string | undefined) {
  const [detalle, setDetalle] = React.useState<DetallePedido | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const recargar = React.useCallback(async () => {
    if (!id) return;
    setCargando(true);
    setError(null);
    const [resPedido, resLineas, resHistorial] = await Promise.all([
      supabase
        .from('pedidos')
        .select('*, cliente:usuarios!pedidos_cliente_id_fkey(id,nombre,apellidos,razon_social,email,telefono,nif_cif)')
        .eq('id', id)
        .single(),
      supabase.from('pedido_lineas').select('*').eq('pedido_id', id).eq('borrado', false).order('created_at'),
      supabase.from('pedido_historial_estados').select('*').eq('pedido_id', id).order('fecha_cambio', { ascending: false }),
    ]);
    setCargando(false);
    if (resPedido.error) {
      setError(resPedido.error.message);
      return;
    }
    const pedido = resPedido.data as Pedido;
    // El nombre del proveedor ya no puede leerse vía embed (RLS de 0011:
    // la tabla proveedores solo la lee el admin); se resuelve por el RPC de
    // nombres visibles (SECURITY DEFINER) según el rol del llamante.
    if (pedido.proveedor_id) {
      const { data: visibles } = await supabase.rpc('fn_proveedores_visibles');
      const fila = ((visibles ?? []) as { id: string; nombre: string }[]).find(
        (p) => p.id === pedido.proveedor_id
      );
      if (fila) pedido.proveedor = { nombre: fila.nombre };
    }
    setDetalle({
      pedido,
      lineas: (resLineas.data ?? []) as LineaPedido[],
      historial: (resHistorial.data ?? []) as HistorialEstado[],
    });
  }, [id]);

  React.useEffect(() => {
    setDetalle(null);
    void recargar();
  }, [recargar]);

  return { detalle, cargando, error, recargar };
}

// Acciones sobre pedidos (todas pasan por RPC: permisos y transacciones en BD).
export function useAccionesPedido() {
  const crear = React.useCallback(
    async (opciones: { cliente_id?: string | null; lineas: { producto_id: string; cantidad: number }[]; observaciones?: string }) => {
      const { data, error } = await supabase.rpc('crear_pedido', {
        p_cliente_id: opciones.cliente_id ?? null,
        p_lineas: opciones.lineas,
        p_observaciones: opciones.observaciones ?? null,
      });
      return { pedido: (data?.[0] as { pedido_id: string; numero_pedido: number } | undefined) ?? null, error: error?.message ?? null };
    },
    []
  );

  const editar = React.useCallback(
    async (pedidoId: string, lineas: { producto_id: string; cantidad: number }[], observaciones?: string) => {
      const { error } = await supabase.rpc('editar_pedido', {
        p_pedido: pedidoId,
        p_lineas: lineas,
        p_observaciones: observaciones ?? null,
      });
      return { error: error?.message ?? null };
    },
    []
  );

  const cancelar = React.useCallback(async (pedidoId: string, nota?: string) => {
    const { error } = await supabase.rpc('cancelar_pedido', { p_pedido: pedidoId, p_nota: nota ?? null });
    return { error: error?.message ?? null };
  }, []);

  const confirmar = React.useCallback(async (pedidoId: string, nota?: string) => {
    const { error } = await supabase.rpc('confirmar_pedido', { p_pedido: pedidoId, p_nota: nota ?? null });
    return { error: error?.message ?? null };
  }, []);

  const avanzar = React.useCallback(async (pedidoId: string, estado: 'en_preparacion' | 'completado', nota?: string) => {
    const { error } = await supabase.rpc('avanzar_pedido', { p_pedido: pedidoId, p_estado: estado, p_nota: nota ?? null });
    return { error: error?.message ?? null };
  }, []);

  const ajustarDescuento = React.useCallback(async (lineaId: string, descuentoPct: number, nota?: string) => {
    const { error } = await supabase.rpc('ajustar_descuento_linea', {
      p_linea_id: lineaId,
      p_descuento_pct: descuentoPct,
      p_nota: nota ?? null,
    });
    return { error: error?.message ?? null };
  }, []);

  return { crear, editar, cancelar, confirmar, avanzar, ajustarDescuento };
}
