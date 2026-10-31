import * as React from 'react';

import { useAuth } from '@/hooks/use-auth';
import { resolverAlcanceCliente } from '@/lib/alcance';
import { supabase } from '@/lib/supabase';
import type { Combustible, ComercialProveedor, DescuentoClienteCombustible, DescuentoClienteProducto, PerfilUsuario, Promocion, Proveedor } from '@/lib/types';

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
  const { perfil } = useAuth();
  const [cliente, setCliente] = React.useState<PerfilUsuario | null>(null);
  const [descuentos, setDescuentos] = React.useState<DescuentoClienteProducto[]>([]);
  const [descuentosCombustible, setDescuentosCombustible] = React.useState<DescuentoClienteCombustible[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const recargar = React.useCallback(async () => {
    if (!id) return;
    setCargando(true);
    setError(null);
    // Anillo 3: validar el alcance ANTES de consultar. El anillo 1 (RLS) ya
    // bloquearía la lectura, pero así el error es legible ('Sin acceso a este
    // cliente') y no se hacen llamadas inútiles.
    const { clienteId, error: errorAlcance } = await resolverAlcanceCliente(id, perfil);
    if (!clienteId) {
      setCliente(null);
      setDescuentos([]);
      setDescuentosCombustible([]);
      setCargando(false);
      setError(errorAlcance ?? 'Sin acceso a este cliente');
      return;
    }
    const [resCliente, resDescuentos, resDescuentosCombustible] = await Promise.all([
      supabase.from('usuarios').select('*').eq('id', clienteId).single(),
      supabase.from('descuentos_cliente_producto').select('*').eq('cliente_id', clienteId).eq('borrado', false),
      supabase.from('descuentos_cliente_combustible').select('*').eq('cliente_id', clienteId).eq('borrado', false),
    ]);
    setCargando(false);
    if (resCliente.error) {
      setError(resCliente.error.message);
    } else {
      setCliente(resCliente.data as PerfilUsuario);
    }
    if (!resDescuentos.error) setDescuentos((resDescuentos.data ?? []) as DescuentoClienteProducto[]);
    if (!resDescuentosCombustible.error)
      setDescuentosCombustible((resDescuentosCombustible.data ?? []) as DescuentoClienteCombustible[]);
  }, [id, perfil]);

  React.useEffect(() => {
    setCliente(null);
    setDescuentos([]);
    setDescuentosCombustible([]);
    setError(null);
    void recargar();
  }, [recargar]);

  return { cliente, descuentos, descuentosCombustible, cargando, error, recargar };
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

  const asignarCombustible = React.useCallback(
    async (clienteId: string, combustible: Combustible, descuentoPct: number, fechaFin?: string | null) => {
      const { error } = await supabase.rpc('asignar_descuento_cliente_combustible', {
        p_cliente_id: clienteId,
        p_combustible: combustible,
        p_descuento_pct: descuentoPct,
        p_fecha_fin: fechaFin ?? null,
      });
      return { error: error?.message ?? null };
    },
    []
  );

  const anularCombustible = React.useCallback(async (clienteId: string, combustible: Combustible) => {
    const { error } = await supabase.rpc('anular_descuento_cliente_combustible', {
      p_cliente_id: clienteId,
      p_combustible: combustible,
    });
    return { error: error?.message ?? null };
  }, []);

  return { asignarGeneral, asignarProducto, anularProducto, asignarCombustible, anularCombustible };
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

// Proveedores del comercial autenticado (RLS: sus propias filas) y catálogo
// de proveedores activos (para mostrar cuáles tiene habilitados). Los nombres
// llegan por el RPC fn_proveedores_visibles (SECURITY DEFINER): la tabla
// proveedores completa (NIF/email/teléfono) solo es legible para el admin.
export function useProveedoresComercial() {
  const [asignaciones, setAsignaciones] = React.useState<ComercialProveedor[]>([]);
  const [proveedores, setProveedores] = React.useState<Proveedor[]>([]);
  const [cargando, setCargando] = React.useState(true);

  const recargar = React.useCallback(async () => {
    setCargando(true);
    const [resAsig, resProv] = await Promise.all([
      supabase.from('comercial_proveedor').select('*').eq('habilitado', true),
      supabase.rpc('fn_proveedores_visibles'),
    ]);
    setCargando(false);
    if (!resAsig.error) setAsignaciones((resAsig.data ?? []) as ComercialProveedor[]);
    // El RPC solo expone id y nombre (el resto de campos de Proveedor no se
    // usa fuera del admin).
    if (!resProv.error) {
      setProveedores(
        ((resProv.data ?? []) as { id: string; nombre: string }[]).map((p) => ({
          id: p.id,
          nombre: p.nombre,
          nif: null,
          email: null,
          telefono: null,
          activo: true,
        }))
      );
    }
  }, []);

  React.useEffect(() => {
    void recargar();
  }, [recargar]);

  return { asignaciones, proveedores, cargando, recargar };
}
