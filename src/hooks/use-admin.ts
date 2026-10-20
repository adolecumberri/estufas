import * as React from 'react';

import { supabase } from '@/lib/supabase';
import type { PerfilUsuario, Promocion } from '@/lib/types';

export interface ProductoAdmin {
  id: string;
  referencia: string;
  nombre: string;
  activo: boolean;
  destacado: boolean;
  tipo_producto_id: string;
  marca_id: string | null;
  producto_precios: { id: string; precio: number; fecha_inicio: string; fecha_fin: string | null }[];
}

// Productos (incluye inactivos: RLS solo lo permite al admin).
export function useProductosAdmin() {
  const [productos, setProductos] = React.useState<ProductoAdmin[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const recargar = React.useCallback(async () => {
    setCargando(true);
    setError(null);
    const { data, error } = await supabase
      .from('productos')
      .select('id,referencia,nombre,activo,destacado,tipo_producto_id,marca_id, producto_precios(id,precio,fecha_inicio,fecha_fin)')
      .eq('borrado', false)
      .order('nombre');
    setCargando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setProductos((data ?? []) as ProductoAdmin[]);
  }, []);

  React.useEffect(() => {
    void recargar();
  }, [recargar]);

  const alternarPublicacion = React.useCallback(async (productoId: string, activo: boolean) => {
    const { error } = await supabase.from('productos').update({ activo }).eq('id', productoId);
    return { error: error?.message ?? null };
  }, []);

  const actualizarPrecio = React.useCallback(async (productoId: string, precio: number) => {
    const { error } = await supabase.rpc('actualizar_precio', { p_producto: productoId, p_precio: precio });
    return { error: error?.message ?? null };
  }, []);

  return { productos, cargando, error, recargar, alternarPublicacion, actualizarPrecio };
}

// Promociones de tienda (gestión: admin).
export function usePromocionesAdmin() {
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

  const crear = React.useCallback(
    async (datos: { nombre: string; descripcion?: string; descuento_porcentaje: number; fecha_fin?: string | null }) => {
      const { error } = await supabase.from('promociones_tienda').insert({
        nombre: datos.nombre,
        descripcion: datos.descripcion ?? null,
        descuento_porcentaje: datos.descuento_porcentaje,
        fecha_fin: datos.fecha_fin ?? null,
        activa: true,
      });
      return { error: error?.message ?? null };
    },
    []
  );

  const alternar = React.useCallback(async (id: string, activa: boolean) => {
    const { error } = await supabase.from('promociones_tienda').update({ activa }).eq('id', id);
    return { error: error?.message ?? null };
  }, []);

  return { promociones, cargando, recargar, crear, alternar };
}

// Usuarios (admin: todos; comercial: su cartera — RLS decide).
export function useUsuarios() {
  const [usuarios, setUsuarios] = React.useState<PerfilUsuario[]>([]);
  const [cargando, setCargando] = React.useState(true);

  const recargar = React.useCallback(async () => {
    setCargando(true);
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('borrado', false)
      .order('nombre');
    setCargando(false);
    setUsuarios((data ?? []) as PerfilUsuario[]);
  }, []);

  React.useEffect(() => {
    void recargar();
  }, [recargar]);

  const asignarComercial = React.useCallback(async (clienteId: string, comercialId: string | null) => {
    if (!comercialId) return { error: 'Selecciona un comercial' };
    const { error } = await supabase.rpc('asignar_comercial', {
      p_cliente_id: clienteId,
      p_comercial_id: comercialId,
    });
    return { error: error?.message ?? null };
  }, []);

  return { usuarios, cargando, recargar, asignarComercial };
}
