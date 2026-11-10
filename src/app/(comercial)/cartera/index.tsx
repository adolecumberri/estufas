import { router, useLocalSearchParams } from 'expo-router';
import { RefreshCw, Users } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { TarjetaCliente } from '@/features/cartera/componentes/tarjeta-cliente';
import type { ResumenDescuentosCliente } from '@/features/cartera/componentes/tarjeta-cliente';
import { useAuth } from '@/features/auth/use-auth';
import { useCartera } from '@/features/cartera/hooks/use-comercial';
import { useSolicitud } from '@/features/carrito/contexto';
import { EmptyState, ErrorView, LoadingView } from '@/shared/componentes/estados';
import { ScreenScroll } from '@/shared/componentes/screen';
import { ScreenHeader } from '@/shared/componentes/screen-header';
import { IconButton } from '@/shared/ui';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { supabase } from '@/shared/lib/supabase';

// Resumen por cliente para las tarjetas (REQUISITOS_FICHA_CLIENTE §A):
// descuentos vigentes por nivel (producto, proveedor, categoría) + nº de
// pedidos visibles. useCartera no expone estos contadores, así que se
// consultan una sola vez aquí, agregados (solo cliente_id/proveedor_id) y
// agrupados en Maps; RLS ya limita el resultado a la cartera del comercial.
// Si alguna consulta falla, su Map queda vacío y la tarjeta muestra 0.
interface ContadoresCartera {
  producto: Map<string, number>;
  proveedor: Map<string, number>;
  categoria: Map<string, number>;
  proveedores: Map<string, { nombre: string; nReglas: number }[]>;
  pedidos: Map<string, number>;
}

export default function Cartera() {
  const { perfil } = useAuth();
  const { setClienteObjetivoId } = useSolicitud();
  // Alcance opcional por comercial (`?comercial=<id>`): el admin, desde la
  // ficha de un comercial, ve SOLO los clientes de ese comercial.
  // `?seleccion` = modo selección (FEEDBACK 10/11 §6): al pulsar un cliente se
  // vuelve a /solicitud con ese cliente elegido, sin abrir su ficha.
  const { comercial, seleccion } = useLocalSearchParams<{
    comercial?: string;
    seleccion?: string;
  }>();
  const modoSeleccion = seleccion != null;
  const { clientes, cargando, error, recargar } = useCartera(comercial);
  const [contadores, setContadores] = React.useState<ContadoresCartera | null>(null);

  const cargarContadores = React.useCallback(async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const vigencia = `fecha_fin.is.null,fecha_fin.gt.${hoy}`;
    const [resProd, resProv, resCat, resPed] = await Promise.all([
      supabase
        .from('descuentos_cliente_producto')
        .select('cliente_id')
        .eq('borrado', false)
        .lte('fecha_inicio', hoy)
        .or(vigencia),
      supabase
        .from('descuentos_cliente_proveedor')
        .select('cliente_id, proveedor_id, proveedor:proveedores(nombre)')
        .eq('borrado', false),
      supabase
        .from('descuentos_cliente_categoria')
        .select('cliente_id, proveedor_id')
        .eq('borrado', false),
      supabase.from('pedidos').select('cliente_id').eq('borrado', false),
    ]);
    const agrupar = (filas: { cliente_id: string }[] | null) => {
      const mapa = new Map<string, number>();
      for (const f of filas ?? []) {
        mapa.set(f.cliente_id, (mapa.get(f.cliente_id) ?? 0) + 1);
      }
      return mapa;
    };
    const producto = resProd.error
      ? new Map()
      : agrupar(resProd.data as { cliente_id: string }[] | null);

    const proveedor = new Map<string, number>();
    const categoria = new Map<string, number>();
    const detalle = new Map<string, Map<string, { nombre: string; nReglas: number }>>();
    const sumarRegla = (clienteId: string, proveedorId: string, nombreProveedor: string | null) => {
      const porCliente = detalle.get(clienteId) ?? new Map();
      const previa = porCliente.get(proveedorId) ?? {
        nombre: nombreProveedor ?? 'Proveedor',
        nReglas: 0,
      };
      porCliente.set(proveedorId, {
        nombre: nombreProveedor ?? previa.nombre,
        nReglas: previa.nReglas + 1,
      });
      detalle.set(clienteId, porCliente);
    };
    if (!resProv.error) {
      for (const f of (resProv.data ?? []) as {
        cliente_id: string;
        proveedor_id: string;
        proveedor: { nombre: string } | { nombre: string }[] | null;
      }[]) {
        proveedor.set(f.cliente_id, (proveedor.get(f.cliente_id) ?? 0) + 1);
        // postgrest-js tipa los embeds to-one como arrays; en runtime es objeto.
        const embed = f.proveedor;
        const nombre = embed
          ? Array.isArray(embed)
            ? (embed[0]?.nombre ?? null)
            : embed.nombre
          : null;
        sumarRegla(f.cliente_id, f.proveedor_id, nombre);
      }
    }
    if (!resCat.error) {
      for (const f of (resCat.data ?? []) as { cliente_id: string; proveedor_id: string }[]) {
        categoria.set(f.cliente_id, (categoria.get(f.cliente_id) ?? 0) + 1);
        sumarRegla(f.cliente_id, f.proveedor_id, null);
      }
    }
    const proveedores = new Map<string, { nombre: string; nReglas: number }[]>();
    for (const [clienteId, porProveedor] of detalle) {
      proveedores.set(clienteId, Array.from(porProveedor.values()));
    }

    setContadores({
      producto,
      proveedor,
      categoria,
      proveedores,
      pedidos: resPed.error ? new Map() : agrupar(resPed.data as { cliente_id: string }[] | null),
    });
  }, []);

  React.useEffect(() => {
    void cargarContadores();
  }, [cargarContadores]);

  const refrescar = () => {
    void recargar();
    void cargarContadores();
  };

  const resumenDe = (clienteId: string): ResumenDescuentosCliente | undefined => {
    if (!contadores) return undefined;
    return {
      proveedor: contadores.proveedor.get(clienteId) ?? 0,
      categoria: contadores.categoria.get(clienteId) ?? 0,
      producto: contadores.producto.get(clienteId) ?? 0,
      proveedores: contadores.proveedores.get(clienteId) ?? [],
    };
  };

  return (
    <>
      <ScreenScroll>
        <ScreenHeader
          titulo="Cartera"
          subtitulo={perfil?.email}
          respaldo="/"
          accion={
            <IconButton
              icono={RefreshCw}
              onPress={refrescar}
              etiquetaAccesibilidad="Recargar cartera"
            />
          }
        />

        {/* Alcance por comercial (entrada vía ?comercial=, p. ej. desde la
            ficha de un comercial en el panel admin). Sin vocabulario de modo:
            el admin tiene pleno acceso operativo (decisión 10/11/2026). */}
        {comercial ? (
          <Card className="gap-1 rounded-lg border-primary/40 bg-primary/10 p-3">
            <Text className="text-sm">Clientes de este comercial</Text>
          </Card>
        ) : null}

        {/* Modo selección (FEEDBACK 10/11 §6): elegir cliente destinatario
            para la solicitud, sin abrir la ficha. */}
        {modoSeleccion ? (
          <Card className="gap-1 rounded-lg border-primary/40 bg-primary/10 p-3">
            <Text className="text-sm">Selecciona el cliente para el pedido</Text>
          </Card>
        ) : null}

        {cargando ? (
          <LoadingView />
        ) : error ? (
          <ErrorView mensaje={error} onReintentar={refrescar} />
        ) : clientes.length === 0 ? (
          <EmptyState titulo="Sin clientes" icono={Users} />
        ) : (
          <View className="gap-3">
            {clientes.map((c) => (
              <TarjetaCliente
                key={c.id}
                cliente={c}
                resumen={resumenDe(c.id)}
                pedidos={contadores?.pedidos.get(c.id) ?? 0}
                onPress={() => {
                  if (modoSeleccion) {
                    // Asigna el cliente (el carrito NO se toca) y navega al
                    // catálogo con él seleccionado (10/11/2026).
                    setClienteObjetivoId(c.id);
                    router.replace('/catalogo');
                    return;
                  }
                  router.push(`/cartera/${c.id}`);
                }}
              />
            ))}
          </View>
        )}
      </ScreenScroll>
    </>
  );
}
