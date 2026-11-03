import * as React from 'react';

import { supabase } from '@/lib/supabase';
import type { ComercialProveedor, Pedido, PerfilUsuario, Promocion, Proveedor } from '@/lib/types';

export interface ProductoAdmin {
  id: string;
  referencia: string;
  nombre: string;
  activo: boolean;
  destacado: boolean;
  tipo_producto_id: string;
  marca_id: string | null;
  proveedor: { nombre: string } | null;
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
      .select(
        'id,referencia,nombre,activo,destacado,tipo_producto_id,marca_id, proveedor:proveedores!productos_proveedor_id_fkey(nombre), producto_precios(id,precio,fecha_inicio,fecha_fin)'
      )
      .eq('borrado', false)
      .order('nombre');
    setCargando(false);
    if (error) {
      setError(error.message);
      return;
    }
    // postgrest-js tipa los embeds como arrays aunque sea una relación to-one;
    // en tiempo de ejecución `proveedor` es un objeto o null.
    setProductos((data ?? []) as unknown as ProductoAdmin[]);
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

// Proveedores (multi-empresa): listado y creación/edición (admin).
export function useProveedores() {
  const [proveedores, setProveedores] = React.useState<Proveedor[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const recargar = React.useCallback(async () => {
    setCargando(true);
    setError(null);
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .eq('borrado', false)
      .order('nombre');
    setCargando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setProveedores((data ?? []) as Proveedor[]);
  }, []);

  React.useEffect(() => {
    void recargar();
  }, [recargar]);

  const crearProveedor = React.useCallback(
    async (datos: { nombre: string; nif?: string | null; email?: string | null; telefono?: string | null }) => {
      const { error } = await supabase.rpc('crear_proveedor', {
        p_nombre: datos.nombre,
        p_nif: datos.nif ?? null,
        p_email: datos.email ?? null,
        p_telefono: datos.telefono ?? null,
      });
      return { error: error?.message ?? null };
    },
    []
  );

  const actualizarProveedor = React.useCallback(
    async (
      proveedorId: string,
      datos: { nombre?: string | null; nif?: string | null; email?: string | null; telefono?: string | null; activo?: boolean | null }
    ) => {
      const { error } = await supabase.rpc('actualizar_proveedor', {
        p_proveedor: proveedorId,
        p_nombre: datos.nombre ?? null,
        p_nif: datos.nif ?? null,
        p_email: datos.email ?? null,
        p_telefono: datos.telefono ?? null,
        p_activo: datos.activo ?? null,
      });
      return { error: error?.message ?? null };
    },
    []
  );

  return { proveedores, cargando, error, recargar, crearProveedor, actualizarProveedor };
}

// Asignaciones comercial ↔ proveedor (admin): asignar, desasignar, habilitar.
export function useAsignacionesProveedores(comercialId: string | undefined) {
  const [asignaciones, setAsignaciones] = React.useState<ComercialProveedor[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const recargar = React.useCallback(async () => {
    if (!comercialId) return;
    setCargando(true);
    setError(null);
    const { data, error } = await supabase
      .from('comercial_proveedor')
      .select('*')
      .eq('comercial_id', comercialId);
    setCargando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAsignaciones((data ?? []) as ComercialProveedor[]);
  }, [comercialId]);

  React.useEffect(() => {
    void recargar();
  }, [recargar]);

  const asignar = React.useCallback(
    async (proveedorId: string) => {
      if (!comercialId) return { error: 'Selecciona un comercial' };
      const { error } = await supabase.rpc('asignar_proveedor_comercial', {
        p_comercial: comercialId,
        p_proveedor: proveedorId,
      });
      return { error: error?.message ?? null };
    },
    [comercialId]
  );

  const desasignar = React.useCallback(
    async (proveedorId: string) => {
      if (!comercialId) return { error: 'Selecciona un comercial' };
      const { error } = await supabase.rpc('desasignar_proveedor_comercial', {
        p_comercial: comercialId,
        p_proveedor: proveedorId,
      });
      return { error: error?.message ?? null };
    },
    [comercialId]
  );

  const habilitar = React.useCallback(
    async (proveedorId: string, habilitado: boolean) => {
      if (!comercialId) return { error: 'Selecciona un comercial' };
      const { error } = await supabase.rpc('habilitar_proveedor_comercial', {
        p_comercial: comercialId,
        p_proveedor: proveedorId,
        p_habilitado: habilitado,
      });
      return { error: error?.message ?? null };
    },
    [comercialId]
  );

  return { asignaciones, cargando, error, recargar, asignar, desasignar, habilitar };
}

// Comerciales (admin): lista de comerciales y sus clientes asignados.
export function useComerciales() {
  const [comerciales, setComerciales] = React.useState<PerfilUsuario[]>([]);
  const [clientesPorComercial, setClientesPorComercial] = React.useState<Record<string, PerfilUsuario[]>>({});
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const recargar = React.useCallback(async () => {
    setCargando(true);
    setError(null);
    const [resComerciales, resClientes] = await Promise.all([
      supabase.from('usuarios').select('*').eq('rol', 'comercial').eq('borrado', false).order('nombre'),
      supabase
        .from('usuarios')
        .select('*')
        .eq('rol', 'cliente')
        .eq('borrado', false)
        .not('id_comercial', 'is', null)
        .order('nombre'),
    ]);
    setCargando(false);
    if (resComerciales.error || resClientes.error) {
      setError(resComerciales.error?.message ?? resClientes.error?.message ?? null);
      return;
    }
    const comerciales = (resComerciales.data ?? []) as PerfilUsuario[];
    const clientes = (resClientes.data ?? []) as PerfilUsuario[];
    const porComercial: Record<string, PerfilUsuario[]> = {};
    for (const c of clientes) {
      if (!c.id_comercial) continue;
      (porComercial[c.id_comercial] ??= []).push(c);
    }
    setComerciales(comerciales);
    setClientesPorComercial(porComercial);
  }, []);

  React.useEffect(() => {
    void recargar();
  }, [recargar]);

  return { comerciales, clientesPorComercial, cargando, error, recargar };
}

// Crear comercial (admin) vía RPC crear_comercial.
export function useCrearComercial() {
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const crearComercial = React.useCallback(
    async (datos: { email: string; password: string; nombre: string; apellidos?: string | null }) => {
      setCargando(true);
      setError(null);
      const { error } = await supabase.rpc('crear_comercial', {
        p_email: datos.email,
        p_password: datos.password,
        p_nombre: datos.nombre,
        p_apellidos: datos.apellidos ?? null,
      });
      setCargando(false);
      if (error) {
        setError(error.message);
        return { error: error.message };
      }
      return { error: null };
    },
    []
  );

  return { crearComercial, cargando, error };
}

// Cliente del detalle de un comercial + sus contadores de descuentos.
export interface ClienteComDescuentos extends PerfilUsuario {
  descuento_porcentaje: number;
  nDescuentosProducto: number;
  nDescuentosCombustible: number;
}

// Detalle de un comercial (admin): perfil, clientes con sus descuentos y
// últimos pedidos.
export function useComercialDetalle(comercialId: string | undefined) {
  const [comercial, setComercial] = React.useState<PerfilUsuario | null>(null);
  const [clientes, setClientes] = React.useState<ClienteComDescuentos[]>([]);
  const [pedidos, setPedidos] = React.useState<Pedido[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const recargar = React.useCallback(async () => {
    if (!comercialId) return;
    setCargando(true);
    setError(null);

    const [resComercial, resClientes, resPedidos] = await Promise.all([
      supabase.from('usuarios').select('*').eq('id', comercialId).single(),
      supabase
        .from('usuarios')
        .select('*')
        .eq('id_comercial', comercialId)
        .eq('borrado', false)
        .order('nombre'),
      supabase
        .from('pedidos')
        .select(
          '*, pedido_lineas(total_linea,cantidad), cliente:usuarios!pedidos_cliente_id_fkey(nombre,apellidos,razon_social)'
        )
        .eq('comercial_id', comercialId)
        .order('fecha_pedido', { ascending: false })
        .limit(20),
    ]);

    if (resComercial.error || resClientes.error || resPedidos.error) {
      setError(resComercial.error?.message ?? resClientes.error?.message ?? resPedidos.error?.message ?? null);
      setCargando(false);
      return;
    }

    const filasClientes = (resClientes.data ?? []) as PerfilUsuario[];
    const ids = filasClientes.map((c) => c.id);

    // Contadores de descuentos vigentes por cliente. Las vistas de vigentes
    // están REVOKEd para authenticated (0002/0006), así que se cuentan desde
    // las tablas base filtrando la vigencia en el cliente.
    const hoy = new Date().toISOString().slice(0, 10);
    const [resProd, resComb] = await Promise.all([
      ids.length > 0
        ? supabase
            .from('descuentos_cliente_producto')
            .select('cliente_id')
            .in('cliente_id', ids)
            .eq('borrado', false)
            .lte('fecha_inicio', hoy)
            .or(`fecha_fin.is.null,fecha_fin.gt.${hoy}`)
        : Promise.resolve({ data: [] as { cliente_id: string }[], error: null }),
      ids.length > 0
        ? supabase
            .from('descuentos_cliente_combustible')
            .select('cliente_id')
            .in('cliente_id', ids)
            .eq('borrado', false)
            .lte('fecha_inicio', hoy)
            .or(`fecha_fin.is.null,fecha_fin.gt.${hoy}`)
        : Promise.resolve({ data: [] as { cliente_id: string }[], error: null }),
    ]);

    if (resProd.error || resComb.error) {
      setError(resProd.error?.message ?? resComb.error?.message ?? null);
      setCargando(false);
      return;
    }

    const cuentaProducto = new Map<string, number>();
    for (const d of (resProd.data ?? []) as { cliente_id: string }[]) {
      cuentaProducto.set(d.cliente_id, (cuentaProducto.get(d.cliente_id) ?? 0) + 1);
    }
    const cuentaCombustible = new Map<string, number>();
    for (const d of (resComb.data ?? []) as { cliente_id: string }[]) {
      cuentaCombustible.set(d.cliente_id, (cuentaCombustible.get(d.cliente_id) ?? 0) + 1);
    }

    setComercial(resComercial.data as PerfilUsuario);
    setClientes(
      filasClientes.map(
        (c) =>
          ({
            ...c,
            descuento_porcentaje: c.descuento_porcentaje ?? 0,
            nDescuentosProducto: cuentaProducto.get(c.id) ?? 0,
            nDescuentosCombustible: cuentaCombustible.get(c.id) ?? 0,
          }) as ClienteComDescuentos
      )
    );
    setPedidos((resPedidos.data ?? []) as unknown as Pedido[]);
    setCargando(false);
  }, [comercialId]);

  React.useEffect(() => {
    setComercial(null);
    setClientes([]);
    setPedidos([]);
    void recargar();
  }, [recargar]);

  return { comercial, clientes, pedidos, cargando, error, recargar };
}
