import { router, useLocalSearchParams } from 'expo-router';
import { FilePlus2, Flame, ReceiptText, User, Wallet } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TarjetaCliente } from '@/features/cartera/componentes/tarjeta-cliente';
import type { ResumenDescuentosCliente } from '@/features/cartera/componentes/tarjeta-cliente';
import { AccionCuenta } from '@/shared/componentes/accion-cuenta';
import { EmptyState, ErrorView, LoadingView } from '@/shared/componentes/estados';
import { Screen } from '@/shared/componentes/screen';
import { ScreenHeader } from '@/shared/componentes/screen-header';
import { SectionTitle } from '@/shared/componentes/section-title';
import { Badge } from '@/shared/ui/badge';
import { Text } from '@/shared/ui/text';
import { ESTADOS_PEDIDO, type EstadoPedido } from '@/shared/constantes';
import { useComercialDetalle } from '@/features/admin/hooks/use-admin';
import { formatEUR, formatFecha } from '@/shared/lib/format';
import { supabase } from '@/shared/lib/supabase';
import { useColoresIcono } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';
import type { Pedido, PerfilUsuario } from '@/shared/lib/types';

// Misma variante de Badge por estado que en la lista de pedidos del comercial.
const varianteEstado = (estado: EstadoPedido) => {
  switch (estado) {
    case 'solicitado':
      return 'secondary' as const;
    case 'confirmado':
      return 'default' as const;
    case 'en_preparacion':
      return 'outline' as const;
    case 'completado':
      return 'secondary' as const;
    case 'cancelado':
      return 'destructive' as const;
  }
};

const nombreDe = (c: PerfilUsuario | null | undefined) =>
  c ? (c.razon_social ?? `${c.nombre} ${c.apellidos ?? ''}`.trim()) : null;

// Pestañas del footer de la vista previa: mismo aspecto que NavInferior, pero
// con el estado local de esta pantalla. Catálogo abre el catálogo DE ESTE
// comercial vía /catalogo?comercial=<id> (bug documentado en
// docs/egm/navegacion_brief.md §4.ii: antes iba a '/' y mostraba el catálogo
// del admin); Solicitud no aplica aquí (se llega desde la ficha del cliente).
type SeccionPreview = 'cartera' | 'pedidos';

const PESTANAS_PREVIEW = [
  { id: 'catalogo', etiqueta: 'Catálogo', icono: Flame },
  { id: 'solicitud', etiqueta: 'Solicitud', icono: FilePlus2 },
  { id: 'pedidos', etiqueta: 'Pedidos', icono: ReceiptText },
  { id: 'cartera', etiqueta: 'Cartera', icono: Wallet },
] as const;

export default function AdminComercialDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colores = useColoresIcono();
  const { comercial, clientes, pedidos, cargando, error, recargar } = useComercialDetalle(id);

  // Vista activa del "app del comercial": Cartera por defecto.
  const [seccion, setSeccion] = React.useState<SeccionPreview>('cartera');

  // Resumen de descuentos por cliente para las tarjetas (REQUISITOS_FICHA_CLIENTE
  // §A.3-4): reglas por nivel y nº de reglas por proveedor, agregadas en la
  // pantalla (el admin tiene SELECT por RLS; no se pudo reutilizar el hook de
  // la cartera del comercial porque vive en otro feature).
  const [resumenes, setResumenes] = React.useState<Map<string, ResumenDescuentosCliente> | null>(
    null
  );

  React.useEffect(() => {
    if (clientes.length === 0) {
      setResumenes(new Map());
      return;
    }
    let cancelado = false;
    const ids = clientes.map((c) => c.id);
    void (async () => {
      const hoy = new Date().toISOString().slice(0, 10);
      const vigencia = `fecha_fin.is.null,fecha_fin.gt.${hoy}`;
      const [resProd, resProv, resCat] = await Promise.all([
        supabase
          .from('descuentos_cliente_producto')
          .select('cliente_id')
          .eq('borrado', false)
          .lte('fecha_inicio', hoy)
          .or(vigencia)
          .in('cliente_id', ids),
        supabase
          .from('descuentos_cliente_proveedor')
          .select('cliente_id, proveedor_id, proveedor:proveedores(nombre)')
          .eq('borrado', false)
          .in('cliente_id', ids),
        supabase
          .from('descuentos_cliente_categoria')
          .select('cliente_id, proveedor_id')
          .eq('borrado', false)
          .in('cliente_id', ids),
      ]);
      if (cancelado) return;
      const cuenta = (filas: { cliente_id: string }[] | null) => {
        const mapa = new Map<string, number>();
        for (const f of filas ?? []) {
          mapa.set(f.cliente_id, (mapa.get(f.cliente_id) ?? 0) + 1);
        }
        return mapa;
      };
      const producto = resProd.error
        ? new Map()
        : cuenta(resProd.data as { cliente_id: string }[] | null);
      const proveedor = new Map<string, number>();
      const categoria = new Map<string, number>();
      const detalle = new Map<string, Map<string, { nombre: string; nReglas: number }>>();
      const sumarRegla = (
        clienteId: string,
        proveedorId: string,
        nombreProveedor: string | null
      ) => {
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
      const mapa = new Map<string, ResumenDescuentosCliente>();
      for (const c of clientes) {
        mapa.set(c.id, {
          proveedor: proveedor.get(c.id) ?? 0,
          categoria: categoria.get(c.id) ?? 0,
          producto: producto.get(c.id) ?? 0,
          proveedores: Array.from(detalle.get(c.id)?.values() ?? []),
        });
      }
      setResumenes(mapa);
    })();
    return () => {
      cancelado = true;
    };
  }, [clientes]);

  const totalDe = (p: Pedido) => (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.total_linea, 0);
  const productosDe = (p: Pedido) =>
    (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.cantidad, 0);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
      >
        <View className="gap-4 p-4">
          {/* Cabecera: nombre y email del comercial */}
          <ScreenHeader
            titulo={
              comercial ? `${comercial.nombre} ${comercial.apellidos ?? ''}`.trim() : 'Comercial'
            }
            subtitulo={comercial?.email ?? undefined}
            respaldo="/admin/comerciales"
            accion={<AccionCuenta />}
          />

          {cargando ? (
            <LoadingView />
          ) : error ? (
            <ErrorView mensaje={error} onReintentar={() => void recargar()} />
          ) : !comercial ? (
            <EmptyState titulo="Comercial no encontrado" />
          ) : seccion === 'cartera' ? (
            /* Sección Cartera: clientes del comercial con la tarjeta reutilizable */
            <View className="gap-3">
              <View className="gap-0.5">
                <SectionTitle>Cartera</SectionTitle>
                <Text className="text-xs text-muted-foreground">
                  Vista de administración · solo lectura
                </Text>
              </View>
              {clientes.length === 0 ? (
                <Text className="text-sm text-muted-foreground">Sin clientes asignados</Text>
              ) : (
                clientes.map((c) => (
                  /* El admin abre la ficha del cliente (cartera) para ver sus
                     condiciones y crearle una solicitud de pedido. El contexto
                     de vuelta viaja en `desde` para volver a esta preview. */
                  <TarjetaCliente
                    key={c.id}
                    cliente={c}
                    resumen={resumenes?.get(c.id)}
                    onPress={() =>
                      router.push(
                        `/cartera/${c.id}?desde=${encodeURIComponent(`/admin/comerciales/${id ?? ''}`)}`
                      )
                    }
                  />
                ))
              )}
            </View>
          ) : (
            /* Sección Pedidos: mismos datos y filas que la vista anterior */
            <View className="gap-3">
              <View className="gap-0.5">
                <SectionTitle>Pedidos</SectionTitle>
                <Text className="text-xs text-muted-foreground">
                  Vista de administración · solo lectura
                </Text>
              </View>
              {pedidos.length === 0 ? (
                <Text className="text-sm text-muted-foreground">Sin pedidos registrados</Text>
              ) : (
                pedidos.map((p) => (
                  /* Fila de pedido navegable: abre el detalle real con
                     `desde` para volver a esta preview (S1 del plan YAGNI). */
                  <Pressable
                    key={p.id}
                    onPress={() =>
                      router.push(
                        `/pedidos/${p.id}?desde=${encodeURIComponent(`/admin/comerciales/${id ?? ''}`)}`
                      )
                    }
                    className="gap-1.5 rounded-md border border-border p-3 active:opacity-80"
                  >
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-semibold">Pedido nº {p.numero_pedido}</Text>
                        <Badge variant={varianteEstado(p.estado)}>
                          <Text>{ESTADOS_PEDIDO[p.estado].etiqueta}</Text>
                        </Badge>
                      </View>
                      <Text className="text-sm font-bold">{formatEUR(totalDe(p))}</Text>
                    </View>
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="text-xs text-muted-foreground">
                        {formatFecha(p.fecha_pedido)}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {productosDe(p)} {productosDe(p) === 1 ? 'producto' : 'productos'}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <User size={14} color={colores.tenue} />
                      <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
                        {nombreDe(p.cliente) ?? 'Cliente sin asignar'}
                      </Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer estilo NavInferior (duplicado a propósito: no modifica el
          componente compartido). Solicitud no aplica en la vista de admin
          (sin onPress). */}
      <View
        className="absolute bottom-0 left-0 right-0 h-16 flex-row items-center justify-around border-t border-border bg-background px-2"
        style={{ height: 64 + insets.bottom, paddingBottom: insets.bottom }}
      >
        {PESTANAS_PREVIEW.map(({ id: tabId, etiqueta, icono: Icono }) => {
          const esActiva = tabId === seccion;
          const sinAccion = tabId === 'solicitud';
          return (
            <Pressable
              key={tabId}
              disabled={sinAccion}
              onPress={() => {
                if (tabId === 'catalogo') {
                  // Catálogo de ESTE comercial (no el del admin): el contexto
                  // viaja en la URL y el back devuelve a esta preview.
                  router.push(`/catalogo?comercial=${id ?? ''}`);
                  return;
                }
                if (tabId === 'solicitud') return; // deshabilitada: sin acción.
                setSeccion(tabId);
              }}
              className={cn(
                'relative flex-col items-center justify-center gap-0.5 py-1 active:opacity-70',
                sinAccion && 'opacity-40'
              )}
            >
              <Icono size={24} color={esActiva ? colores.primario : colores.tenue} />
              <Text
                className={cn(
                  'text-[11px] leading-tight',
                  esActiva ? 'font-medium text-primary' : 'text-muted-foreground'
                )}
              >
                {etiqueta}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
