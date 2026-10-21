import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { ESTADOS_PEDIDO, ORIGENES_DESCUENTO, type EstadoPedido } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import { useAccionesPedido, usePedido } from '@/hooks/use-pedidos';
import { formatEUR, formatFechaHora } from '@/lib/format';
import { useColoresIcono } from '@/lib/theme';

export default function PedidoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { session, perfil } = useAuth();
  const { detalle, cargando, error, recargar } = usePedido(id);
  const { cancelar, confirmar, avanzar, ajustarDescuento } = useAccionesPedido();
  const colores = useColoresIcono();

  const [lineaAjuste, setLineaAjuste] = React.useState<string | null>(null);
  const [pctAjuste, setPctAjuste] = React.useState('');
  const [mensaje, setMensaje] = React.useState<string | null>(null);
  const [trabajando, setTrabajando] = React.useState(false);

  if (!session) return <Redirect href="/acceso" />;

  const esComercial = perfil?.rol === 'comercial';
  const esAdmin = perfil?.rol === 'admin';
  const esCliente = perfil?.rol === 'cliente';
  const puedeGestionar = esComercial || esAdmin;

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

  if (cargando || !detalle) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        {error ? (
          <Text className="px-8 text-center text-muted-foreground">{error}</Text>
        ) : (
          <ActivityIndicator color="hsl(24.6 95% 53.1%)" />
        )}
      </View>
    );
  }

  const { pedido, lineas, historial } = detalle;
  const total = lineas.reduce((acc, l) => acc + l.total_linea, 0);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ paddingTop: insets.top + 8 }} className="gap-4 p-4">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.back()} className="rounded-md p-1 active:bg-accent">
            <ChevronLeft size={24} color={colores.primerPlano} />
          </Pressable>
          <Text className="text-xl font-bold tracking-tight">Pedido nº {pedido.numero_pedido}</Text>
          <Badge variant={varianteEstado(pedido.estado)} className="ml-auto">
            <Text>{ESTADOS_PEDIDO[pedido.estado].etiqueta}</Text>
          </Badge>
        </View>

        <Card className="rounded-[10px]">
          <CardContent className="gap-1">
            <Text className="text-xs text-muted-foreground">Fecha</Text>
            <Text className="text-sm">{formatFechaHora(pedido.fecha_pedido)}</Text>
            {pedido.observaciones && (
              <>
                <Text className="mt-2 text-xs text-muted-foreground">Observaciones</Text>
                <Text className="text-sm">{pedido.observaciones}</Text>
              </>
            )}
          </CardContent>
        </Card>

        {/* Cliente (visible para comercial/admin) */}
        {puedeGestionar && pedido.cliente && (
          <Card className="rounded-[10px]">
            <CardContent className="gap-1">
              <Text className="text-xs text-muted-foreground">Cliente</Text>
              <Text className="text-sm font-medium">
                {pedido.cliente.razon_social ??
                  `${pedido.cliente.nombre} ${pedido.cliente.apellidos ?? ''}`.trim()}
              </Text>
              <Text className="text-sm">{pedido.cliente.email}</Text>
              {pedido.cliente.telefono && <Text className="text-sm">{pedido.cliente.telefono}</Text>}
              {pedido.cliente.nif_cif && (
                <Text className="text-xs text-muted-foreground">{pedido.cliente.nif_cif}</Text>
              )}
            </CardContent>
          </Card>
        )}

        {/* Líneas */}
        <Card className="rounded-[10px] p-3">
          <CardHeader className="px-3 pt-1">
            <CardTitle className="text-base">Líneas</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-3">
            {lineas.map((l) => (
              <View key={l.id} className="gap-1">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-sm font-medium">
                      {l.cantidad} × {l.nombre_producto}
                    </Text>
                    <Text className="text-xs text-muted-foreground">{l.referencia_producto}</Text>
                  </View>
                  <Text className="text-sm font-semibold">{formatEUR(l.total_linea)}</Text>
                </View>
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-xs text-muted-foreground">
                    {l.descuento_porcentaje > 0 ? (
                      <>
                        <Text className="text-xs text-muted-foreground line-through">
                          {formatEUR(l.precio_unitario)}/ud
                        </Text>{' '}
                        <Text className="text-xs font-semibold text-foreground">
                          {formatEUR(l.total_linea / l.cantidad)}/ud
                        </Text>
                      </>
                    ) : (
                      <>{formatEUR(l.precio_unitario)}/ud</>
                    )}
                    {l.descuento_porcentaje > 0 &&
                      ` · ${ORIGENES_DESCUENTO[l.descuento_origen].etiqueta} ${l.descuento_porcentaje}%`}
                  </Text>
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
                        <Text className="text-xs">Ajustar descuento</Text>
                      </Button>
                    )}
                  </View>
                )}
              </View>
            ))}
            <Separator />
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted-foreground">Total (sin impuestos)</Text>
              <Text className="text-lg font-bold">{formatEUR(total)}</Text>
            </View>
          </CardContent>
        </Card>

        {/* Acciones por rol y estado */}
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
                <Text>Confirmar pedido</Text>
              </Button>
              <Button
                variant="outline"
                className="border-destructive"
                disabled={trabajando}
                onPress={() => void ejecutar(() => cancelar(pedido.id, 'Cancelado por comercial'), 'Pedido cancelado')}
              >
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

        {/* Historial */}
        <Card className="rounded-[10px]">
          <CardHeader>
            <CardTitle className="text-base">Historial de estados</CardTitle>
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
