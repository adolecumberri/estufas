import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  History,
  SlidersHorizontal,
  UserRound,
  XCircle,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { ESTADOS_PEDIDO, ORIGENES_DESCUENTO, TIPOS_CLIENTE, type EstadoPedido } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import { useCatalogo } from '@/hooks/use-catalogo';
import { useAccionesPedido, usePedido } from '@/hooks/use-pedidos';
import { obtenerProducto } from '@/lib/catalogo-local';
import { formatEUR, formatFecha, formatFechaHora } from '@/lib/format';
import { fuenteImagen } from '@/lib/imagenes';
import { useColoresIcono } from '@/lib/theme';

export default function PedidoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { session, perfil } = useAuth();
  const { detalle, cargando, error, recargar } = usePedido(id);
  const { cancelar, confirmar, avanzar, ajustarDescuento } = useAccionesPedido();
  const catalogo = useCatalogo();
  const colores = useColoresIcono();

  const [lineaAjuste, setLineaAjuste] = React.useState<string | null>(null);
  const [pctAjuste, setPctAjuste] = React.useState('');
  const [mensaje, setMensaje] = React.useState<string | null>(null);
  const [trabajando, setTrabajando] = React.useState(false);

  if (!session) return <Redirect href="/acceso" />;
  // El admin no gestiona pedidos: si llega por URL, vuelve a su panel.
  if (perfil?.rol === 'admin') return <Redirect href="/admin" />;

  const esComercial = perfil?.rol === 'comercial';
  const esCliente = perfil?.rol === 'cliente';
  const puedeGestionar = esComercial;

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

  const ejecutar = async (fn: () => Promise<{ error: string | null }>, ok: string) => {
    setTrabajando(true);
    setMensaje(null);
    const { error } = await fn();
    setTrabajando(false);
    if (error) {
      setMensaje(error);
      return;
    }
    setMensaje(ok);
    await recargar();
  };

  // Ficha local de cada producto del pedido (imagen, tipo y marca para las
  // miniaturas y las líneas). Consulta directa al SQLite local; si la
  // plataforma no lo soporta o el producto no está, se intenta con el
  // catálogo paginado del hook y, si no, se usará el placeholder empaquetado.
  const fichasLinea = React.useMemo(() => {
    const mapa = new Map<
      string,
      { imagen_url: string | null; tipo: string | null; marca: string | null }
    >();
    if (!detalle) return mapa;
    for (const l of detalle.lineas) {
      if (mapa.has(l.producto_id)) continue;
      try {
        const fila = obtenerProducto(l.producto_id);
        if (fila) {
          mapa.set(l.producto_id, {
            imagen_url: fila.imagen_url,
            tipo: fila.tipo,
            marca: fila.marca_nombre,
          });
          continue;
        }
      } catch {
        // SQLite no disponible (p. ej. web): fallback al catálogo del hook.
      }
      const p = catalogo.productos.find((c) => c.producto_id === l.producto_id);
      mapa.set(
        l.producto_id,
        p
          ? { imagen_url: p.imagen_url, tipo: p.tipo, marca: p.marca }
          : { imagen_url: null, tipo: null, marca: null }
      );
    }
    return mapa;
  }, [detalle, catalogo.productos]);

  if (cargando || !detalle) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        {error ? (
          <Text className="px-8 text-center text-muted-foreground">{error}</Text>
        ) : (
          <ActivityIndicator color="hsl(124.3 17.7% 31%)" />
        )}
      </View>
    );
  }

  const { pedido, lineas, historial } = detalle;
  const total = lineas.reduce((acc, l) => acc + l.total_linea, 0);

  // El embed `pedido.proveedor` lo añade el worker backend (types.ts +
  // use-pedidos.ts). Cast seguro mientras el campo no esté en el tipo Pedido;
  // cuando llegue, basta con usar `pedido.proveedor?.nombre` directamente.
  const proveedorPedido = (pedido as typeof pedido & { proveedor?: { nombre: string } | null }).proveedor;

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ paddingTop: insets.top + 8 }} className="gap-4 p-4">
        {/* 1. Cabecera: volver + Detalle de Gestión + nº + estado */}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.back()}
            className="rounded-[10px] bg-accent p-2 active:bg-accent"
            accessibilityLabel="Volver al listado de pedidos"
          >
            <ArrowLeft size={20} color={colores.primerPlano} />
          </Pressable>
          <View className="flex-1 gap-0.5">
            <Text className="text-xs uppercase tracking-wider text-muted-foreground">
              Detalle de Gestión
            </Text>
            <Text className="text-xl font-bold tracking-tight">
              Pedido nº {pedido.numero_pedido}
            </Text>
          </View>
          <Badge variant={varianteEstado(pedido.estado)}>
            <Text>{ESTADOS_PEDIDO[pedido.estado].etiqueta}</Text>
          </Badge>
        </View>

        {/* 2. Miniaturas de productos del pedido */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12 }}
          className="-mx-4 px-4"
        >
          {lineas.map((l) => {
            const ficha = fichasLinea.get(l.producto_id);
            return (
              <View
                key={l.id}
                className="relative aspect-[4/3] w-44 overflow-hidden rounded-[10px] bg-muted"
              >
                <Image
                  source={fuenteImagen(ficha?.imagen_url ?? null)}
                  className="h-full w-full"
                  contentFit="cover"
                  transition={150}
                />
                <View className="absolute inset-x-2 bottom-2 flex-row items-center justify-between gap-2 rounded-lg bg-background/90 px-2 py-1.5">
                  <Text numberOfLines={1} className="flex-1 text-xs font-semibold">
                    {l.nombre_producto}
                  </Text>
                  <Text className="text-xs font-bold text-primary">{l.cantidad}×</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* 3. Fecha de registro + ID */}
        <Card className="rounded-[10px]">
          <CardContent className="gap-1">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-2">
                <CalendarDays size={16} color={colores.tenue} />
                <View>
                  <Text className="text-xs text-muted-foreground">Fecha de registro</Text>
                  <Text className="text-sm">{formatFecha(pedido.fecha_pedido)}</Text>
                </View>
              </View>
              <Text className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                ID: #ORD-{pedido.id.slice(0, 6).toUpperCase()}
              </Text>
            </View>
            {pedido.observaciones && (
              <>
                <Text className="mt-2 text-xs text-muted-foreground">Observaciones</Text>
                <Text className="text-sm">{pedido.observaciones}</Text>
              </>
            )}
            {/* El detalle trae proveedor_id; el NOMBRE llega con el embed
                pedido.proveedor (backend). Sin nombre se muestra el id. */}
            {puedeGestionar && pedido.proveedor_id && (
              <>
                <Text className="mt-2 text-xs text-muted-foreground">Proveedor</Text>
                <Text className="text-sm">{proveedorPedido?.nombre ?? pedido.proveedor_id}</Text>
              </>
            )}
          </CardContent>
        </Card>

        {/* 4. Cliente (visible para comercial/admin) */}
        {puedeGestionar && pedido.cliente && (
          <Card className="rounded-[10px]">
            <CardContent className="gap-2">
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-row items-center gap-1.5">
                  <Building2 size={16} color={colores.tenue} />
                  <Text className="text-xs uppercase tracking-wider text-muted-foreground">
                    Cliente
                  </Text>
                </View>
                <Badge variant="outline" className="gap-1">
                  <BadgeCheck size={12} color={colores.primario} />
                  <Text>
                    {pedido.cliente.tipo_cliente
                      ? TIPOS_CLIENTE[pedido.cliente.tipo_cliente].etiqueta
                      : 'Cliente'}
                  </Text>
                </Badge>
              </View>
              <Text className="text-base font-medium">
                {pedido.cliente.razon_social ??
                  `${pedido.cliente.nombre} ${pedido.cliente.apellidos ?? ''}`.trim()}
              </Text>
              <Text className="text-sm text-muted-foreground">{pedido.cliente.email}</Text>
              {pedido.cliente.telefono && (
                <Text className="text-sm text-muted-foreground">{pedido.cliente.telefono}</Text>
              )}
              {pedido.cliente.nif_cif && (
                <Text className="self-start rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  CIF: {pedido.cliente.nif_cif}
                </Text>
              )}
              <Button
                size="sm"
                variant="outline"
                className="self-start"
                onPress={() => router.push(`/cartera/${pedido.cliente_id}`)}
              >
                <UserRound size={14} color={colores.tenue} />
                <Text className="text-xs">Ver ficha</Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 5. Líneas de Producto + resumen */}
        <Card className="rounded-[10px] p-3">
          <CardHeader className="px-3 pt-1">
            <View className="flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Líneas de Producto</CardTitle>
              <Text className="text-xs text-muted-foreground">
                {lineas.length} {lineas.length === 1 ? 'artículo' : 'artículos'}
              </Text>
            </View>
          </CardHeader>
          <CardContent className="gap-3 px-3">
            {lineas.map((l) => {
              const ficha = fichasLinea.get(l.producto_id);
              const infoLinea = [ficha?.marca, ficha?.tipo].filter(Boolean).join(' · ');
              return (
                <View key={l.id} className="gap-1.5 rounded-[10px] bg-muted p-3">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1 flex-row items-center gap-1.5">
                      <Text className="rounded bg-accent px-1.5 py-0.5 text-xs font-medium">
                        {l.cantidad}×
                      </Text>
                      <Text className="flex-1 text-sm font-medium">{l.nombre_producto}</Text>
                    </View>
                    <Text className="text-sm font-semibold">{formatEUR(l.total_linea)}</Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    Ref: {l.referencia_producto}
                    {infoLinea ? ` · ${infoLinea}` : ''}
                  </Text>
                  <View className="flex-row flex-wrap items-center gap-1.5">
                    {l.descuento_porcentaje > 0 ? (
                      <>
                        <Text className="text-xs text-muted-foreground line-through">
                          {formatEUR(l.precio_unitario)}/ud
                        </Text>
                        <Text className="text-xs font-semibold">
                          {formatEUR(l.total_linea / l.cantidad)}/ud
                        </Text>
                        <Badge variant="outline" className="border-primary/40 bg-primary/10">
                          <Text className="text-primary">
                            -{l.descuento_porcentaje}%{' '}
                            {ORIGENES_DESCUENTO[l.descuento_origen]?.etiqueta ?? 'Descuento'}
                          </Text>
                        </Badge>
                      </>
                    ) : (
                      <Text className="text-xs text-muted-foreground">
                        {formatEUR(l.precio_unitario)}/ud
                      </Text>
                    )}
                  </View>

                  {puedeGestionar && pedido.estado === 'solicitado' && (
                    <View className="mt-1">
                      {lineaAjuste === l.id ? (
                        <View className="flex-row items-center gap-2">
                          <Input
                            keyboardType="decimal-pad"
                            value={pctAjuste}
                            onChangeText={setPctAjuste}
                            placeholder="%"
                            className="h-9 w-20 text-sm"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={trabajando}
                            onPress={() =>
                              void ejecutar(async () => {
                                const pct = Number(pctAjuste.replace(',', '.'));
                                if (Number.isNaN(pct) || pct < 0 || pct > 100) {
                                  return { error: 'Porcentaje inválido (0-100)' };
                                }
                                setLineaAjuste(null);
                                return ajustarDescuento(l.id, pct, `Ajuste a ${pct}%`);
                              }, 'Descuento actualizado')
                            }
                          >
                            <Text>Aplicar</Text>
                          </Button>
                          <Button size="sm" variant="ghost" onPress={() => setLineaAjuste(null)}>
                            <Text className="text-xs">Cancelar</Text>
                          </Button>
                        </View>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => {
                            setLineaAjuste(l.id);
                            setPctAjuste(String(l.descuento_porcentaje));
                          }}
                        >
                          <SlidersHorizontal size={14} color={colores.tenue} />
                          <Text className="text-xs">Ajustar descuento</Text>
                        </Button>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            <Separator />

            {/* Resumen B2B */}
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted-foreground">Suma de partidas</Text>
              <Text className="text-sm text-muted-foreground">{formatEUR(total)}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted-foreground">Gastos de portes</Text>
              <Text className="text-sm font-medium text-emerald-600">
                Bonificado {formatEUR(0)}
              </Text>
            </View>
            <View className="flex-row items-center justify-between rounded-[10px] bg-muted p-3">
              <View className="gap-0.5">
                <Text className="text-xs uppercase tracking-wider text-muted-foreground">
                  Total (sin impuestos)
                </Text>
                <Text className="text-2xl font-bold">{formatEUR(total)}</Text>
              </View>
              <View className="h-10 w-10 items-center justify-center rounded-[10px] bg-primary/10">
                <Banknote size={20} color={colores.primario} />
              </View>
            </View>
            <Text className="text-center text-xs text-muted-foreground">
              Precios netos B2B sin IVA según condiciones comerciales vigentes de distribución.
            </Text>
          </CardContent>
        </Card>

        {/* 6. Acciones por rol y estado */}
        <View className="gap-2">
          {esCliente && pedido.estado === 'solicitado' && (
            <>
              <Button onPress={() => router.push(`/solicitud?editar=${pedido.id}`)}>
                <Text>Editar solicitud</Text>
              </Button>
              <Button
                variant="outline"
                className="border-destructive"
                disabled={trabajando}
                onPress={() => void ejecutar(() => cancelar(pedido.id, 'Cancelado por el cliente'), 'Pedido cancelado')}
              >
                <XCircle size={18} color={colores.destructivo} />
                <Text className="text-destructive">Cancelar solicitud</Text>
              </Button>
            </>
          )}
          {puedeGestionar && pedido.estado === 'solicitado' && (
            <>
              <Button
                disabled={trabajando}
                onPress={() => void ejecutar(() => confirmar(pedido.id, 'Pedido confirmado'), 'Pedido confirmado')}
              >
                <CheckCircle2 size={18} color={colores.primarioClaro} />
                <Text>Confirmar pedido</Text>
              </Button>
              <Button
                variant="outline"
                className="border-destructive"
                disabled={trabajando}
                onPress={() => void ejecutar(() => cancelar(pedido.id, 'Cancelado por comercial'), 'Pedido cancelado')}
              >
                <XCircle size={18} color={colores.destructivo} />
                <Text className="text-destructive">Cancelar pedido</Text>
              </Button>
            </>
          )}
          {puedeGestionar && pedido.estado === 'confirmado' && (
            <>
              <Button
                disabled={trabajando}
                onPress={() =>
                  void ejecutar(() => avanzar(pedido.id, 'en_preparacion', 'Pasa a preparación'), 'Pedido en preparación')
                }
              >
                <Text>Marcar en preparación</Text>
              </Button>
              <Button
                variant="outline"
                className="border-destructive"
                disabled={trabajando}
                onPress={() => void ejecutar(() => cancelar(pedido.id, 'Cancelado por comercial'), 'Pedido cancelado')}
              >
                <XCircle size={18} color={colores.destructivo} />
                <Text className="text-destructive">Cancelar pedido</Text>
              </Button>
            </>
          )}
          {puedeGestionar && pedido.estado === 'en_preparacion' && (
            <Button
              disabled={trabajando}
              onPress={() => void ejecutar(() => avanzar(pedido.id, 'completado', 'Pedido completado'), 'Pedido completado')}
            >
              <Text>Marcar completado</Text>
            </Button>
          )}
          {mensaje && <Text className="text-sm text-muted-foreground">{mensaje}</Text>}
        </View>

        {/* 7. Historial de estados */}
        <Card className="rounded-[10px]">
          <CardHeader>
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-2">
                <History size={16} color={colores.tenue} />
                <CardTitle className="text-base">Historial de estados</CardTitle>
              </View>
              <Text className="text-xs text-muted-foreground">Registro auditable</Text>
            </View>
          </CardHeader>
          <CardContent className="gap-2">
            {historial.map((h) => (
              <View key={h.id} className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-sm">
                    {h.estado_anterior ? (
                      <>
                        {ESTADOS_PEDIDO[h.estado_anterior].etiqueta} →{' '}
                        <Text className="font-medium">{ESTADOS_PEDIDO[h.estado_nuevo].etiqueta}</Text>
                      </>
                    ) : (
                      <Text className="font-medium">Creado ({ESTADOS_PEDIDO[h.estado_nuevo].etiqueta})</Text>
                    )}
                  </Text>
                  {h.nota && <Text className="text-xs text-muted-foreground">{h.nota}</Text>}
                </View>
                <Text className="text-xs text-muted-foreground">{formatFechaHora(h.fecha_cambio)}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}
