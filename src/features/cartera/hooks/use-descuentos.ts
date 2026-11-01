import * as React from 'react';

import { supabase } from '@/shared/lib/supabase';
import { rpcSegura } from '@/shared/lib/supabase-seguro';

// ============================================================================
// Descuentos de un cliente (0024/0026): reglas activas por proveedor y por
// categoría, historial con actor, y escritura vía RPC seguros (anillo 3). La
// autoridad real de alcance (anillo 1) vive en los RPC y en RLS.
// ============================================================================

// Fila del historial con los nombres resueltos (joins del select). Los embeds
// llegan como objeto o null en tiempo de ejecución.
export interface FilaHistorialDescuento {
  id: number;
  nivel: 'general' | 'proveedor' | 'categoria' | 'producto';
  accion: 'crear' | 'actualizar' | 'anular';
  descuento_porcentaje: number | null;
  created_at: string;
  proveedor_id: string | null;
  categoria_id: string | null;
  producto_id: string | null;
  actor_id: string | null;
  actor_rol: string | null;
  proveedor: { nombre: string } | null;
  categoria: { nombre: string } | null;
  producto: { nombre: string } | null;
  actor: { nombre: string } | null;
}

export interface DescuentoProveedorCliente {
  proveedor_id: string;
  pct: number;
}

export interface DescuentoCategoriaCliente {
  proveedor_id: string;
  categoria_id: string;
  pct: number;
}

// Qué regla anular, según su nivel.
export type AnularDescuento =
  | { nivel: 'general' }
  | { nivel: 'proveedor'; proveedorId: string }
  | { nivel: 'categoria'; proveedorId: string; categoriaId: string }
  | { nivel: 'producto'; productoId: string };

// DTO del RPC fn_descuentos_cuenta (0025): las claves nuevas 'categorias' y
// 'proveedores' se leen con fallback (los snapshots antiguos no las traen).
interface DescuentosCuentaDTO {
  general_pct: number | null;
  productos: { producto_id: string; pct: number }[];
  combustibles: { combustible: string; pct: number }[];
  categorias?: DescuentoCategoriaCliente[];
  proveedores?: DescuentoProveedorCliente[];
  promo_pct: number | null;
  proveedores_habilitados: string[];
}

// Descuentos del cliente `clienteId`: reglas activas (proveedores y
// categorías), historial (últimas 30 entradas, orden descendente) y las
// escrituras guardar*/anular. Cada escritura pasa por rpcSegura (traduce los
// errores de permiso) y recarga el estado si tiene éxito.
export function useDescuentosCliente(clienteId: string | null | undefined) {
  const [proveedores, setProveedores] = React.useState<DescuentoProveedorCliente[]>([]);
  const [categorias, setCategorias] = React.useState<DescuentoCategoriaCliente[]>([]);
  const [historial, setHistorial] = React.useState<FilaHistorialDescuento[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const recargar = React.useCallback(async () => {
    if (!clienteId) {
      setProveedores([]);
      setCategorias([]);
      setHistorial([]);
      setCargando(false);
      setError(null);
      return;
    }
    setCargando(true);
    setError(null);
    const [resCuenta, resHistorial] = await Promise.all([
      rpcSegura<DescuentosCuentaDTO>('fn_descuentos_cuenta', { p_cliente: clienteId }),
      supabase
        .from('descuentos_historial')
        .select(
          '*, proveedor:proveedores(nombre), categoria:categorias(nombre), producto:productos(nombre), actor:usuarios(nombre)'
        )
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);
    setCargando(false);
    if (resCuenta.error) {
      setError(resCuenta.error);
      return;
    }
    setProveedores(resCuenta.data?.proveedores ?? []);
    setCategorias(resCuenta.data?.categorias ?? []);
    if (resHistorial.error) {
      setError(resHistorial.error.message);
      return;
    }
    // postgrest-js tipa los embeds como arrays aunque sean relaciones to-one;
    // en tiempo de ejecución cada embed es un objeto o null.
    setHistorial((resHistorial.data ?? []) as unknown as FilaHistorialDescuento[]);
  }, [clienteId]);

  React.useEffect(() => {
    void recargar();
  }, [recargar]);

  // Escritura común: rpcSegura + recarga automática en éxito. Devuelve el
  // error (legible) y si fue una denegación de permisos.
  const ejecutar = React.useCallback(
    async (nombre: string, params: Record<string, unknown>) => {
      const res = await rpcSegura(nombre, params);
      if (!res.error) await recargar();
      return { error: res.error, esPermiso: res.esPermiso };
    },
    [recargar]
  );

  const guardarGeneral = React.useCallback(
    (pct: number) =>
      ejecutar('fn_upsert_descuento_general', { p_cliente: clienteId, p_porcentaje: pct }),
    [ejecutar, clienteId]
  );

  const guardarProveedor = React.useCallback(
    (proveedorId: string, pct: number) =>
      ejecutar('fn_upsert_descuento_proveedor', {
        p_cliente: clienteId,
        p_proveedor: proveedorId,
        p_porcentaje: pct,
      }),
    [ejecutar, clienteId]
  );

  const guardarCategoria = React.useCallback(
    (proveedorId: string, categoriaId: string, pct: number) =>
      ejecutar('fn_upsert_descuento_categoria', {
        p_cliente: clienteId,
        p_proveedor: proveedorId,
        p_categoria: categoriaId,
        p_porcentaje: pct,
      }),
    [ejecutar, clienteId]
  );

  const guardarProducto = React.useCallback(
    (productoId: string, pct: number) =>
      ejecutar('fn_upsert_descuento_producto', {
        p_cliente: clienteId,
        p_producto: productoId,
        p_porcentaje: pct,
      }),
    [ejecutar, clienteId]
  );

  const anular = React.useCallback(
    (que: AnularDescuento) => {
      switch (que.nivel) {
        case 'general':
          return ejecutar('fn_anular_descuento_general', { p_cliente: clienteId });
        case 'proveedor':
          return ejecutar('fn_anular_descuento_proveedor', {
            p_cliente: clienteId,
            p_proveedor: que.proveedorId,
          });
        case 'categoria':
          return ejecutar('fn_anular_descuento_categoria', {
            p_cliente: clienteId,
            p_proveedor: que.proveedorId,
            p_categoria: que.categoriaId,
          });
        case 'producto':
          // Sin RPC de anulación nuevo en 0026 para producto: se usa el legado
          // de 0003 (mismo alcance y auditoría).
          return ejecutar('anular_descuento_cliente_producto', {
            p_cliente_id: clienteId,
            p_producto_id: que.productoId,
          });
      }
    },
    [ejecutar, clienteId]
  );

  return {
    proveedores,
    categorias,
    historial,
    cargando,
    error,
    recargar,
    guardarGeneral,
    guardarProveedor,
    guardarCategoria,
    guardarProducto,
    anular,
  };
}
