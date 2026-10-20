import * as React from 'react';

import { supabase } from '@/lib/supabase';
import type { DescuentoClienteProducto, PerfilUsuario, Promocion } from '@/lib/types';

// Cartera comercial: clientes asignados (RLS lo garantiza) y sus pedidos.
export function useCartera() {
  const [clientes, setClientes] = React.useState<PerfilUsuario[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const recargar = React.useCallback(async () => {
    setCargando(true);
    setError(null);
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('rol', 'cliente')
      .eq('borrado', false)
      .order('nombre');
    setCargando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setClientes((data ?? []) as PerfilUsuario[]);
  }, []);

  React.useEffect(() => {
    void recargar();
  }, [recargar]);

  return { clientes, cargando, error, recargar };
}

export function useCliente(id: string | undefined) {
  const [cliente, setCliente] = React.useState<PerfilUsuario | null>(null);
  const [descuentos, setDescuentos] = React.useState<DescuentoClienteProducto[]>([]);
  const [cargando, setCargando] = React.useState(true);

  const recargar = React.useCallback(async () => {
    if (!id) return;
    setCargando(true);
    const [resCliente, resDescuentos] = await Promise.all([
      supabase.from('usuarios').select('*').eq('id', id).single(),
      supabase.from('descuentos_cliente_producto').select('*').eq('cliente_id', id).eq('borrado', false),
    ]);
    setCargando(false);
    if (!resCliente.error) setCliente(resCliente.data as PerfilUsuario);
    if (!resDescuentos.error) setDescuentos((resDescuentos.data ?? []) as DescuentoClienteProducto[]);
  }, [id]);

  React.useEffect(() => {
    setCliente(null);
    setDescuentos([]);
    void recargar();
  }, [recargar]);

  return { cliente, descuentos, cargando, recargar };
}

// Descuentos: los aplica el comercial de la cartera o el admin (RPC).
export function useDescuentos() {
  const asignarGeneral = React.useCallback(async (clienteId: string, descuentoPct: number) => {
    const { error } = await supabase.rpc('asignar_descuento_cliente', {
      p_cliente_id: clienteId,
      p_descuento_pct: descuentoPct,
    });
    return { error: error?.message ?? null };
  }, []);

  const asignarProducto = React.useCallback(
    async (clienteId: string, productoId: string, descuentoPct: number, fechaFin?: string | null) => {
      const { error } = await supabase.rpc('asignar_descuento_cliente_producto', {
        p_cliente_id: clienteId,
        p_producto_id: productoId,
        p_descuento_pct: descuentoPct,
        p_fecha_fin: fechaFin ?? null,
      });
      return { error: error?.message ?? null };
    },
    []
  );

  const anularProducto = React.useCallback(async (clienteId: string, productoId: string) => {
    const { error } = await supabase.rpc('anular_descuento_cliente_producto', {
      p_cliente_id: clienteId,
      p_producto_id: productoId,
    });
    return { error: error?.message ?? null };
  }, []);

  return { asignarGeneral, asignarProducto, anularProducto };
}

// Promociones de tienda (visibles para usuarios autenticados).
export function usePromociones() {
  const [promociones, setPromociones] = React.useState<Promocion[]>([]);
  const [cargando, setCargando] = React.useState(true);

  const recargar = React.useCallback(async () => {
    setCargando(true);
    const { data } = await supabase
      .from('promociones_tienda')
      .select('*')
      .eq('borrado', false)
      .order('fecha_inicio', { ascending: false });
    setCargando(false);
    setPromociones((data ?? []) as Promocion[]);
  }, []);

  React.useEffect(() => {
    void recargar();
  }, [recargar]);

  return { promociones, cargando, recargar };
}
