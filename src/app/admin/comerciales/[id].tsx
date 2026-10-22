import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, User } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { ESTADOS_PEDIDO, type EstadoPedido } from '@/constants';
import { useComercialDetalle } from '@/hooks/use-admin';
import { useAuth } from '@/hooks/use-auth';
import { formatEUR, formatFecha, formatPct } from '@/lib/format';
import { useColoresIcono } from '@/lib/theme';
import type { Pedido, PerfilUsuario } from '@/lib/types';

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

export default function AdminComercialDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colores = useColoresIcono();
  const { session, perfil } = useAuth();
  const { comercial, clientes, pedidos, cargando, error, recargar } = useComercialDetalle(id);

  if (!session) return <Redirect href="/acceso" />;
  if (perfil && perfil.rol !== 'admin') return <Redirect href="/pedidos" />;

  const totalDe = (p: Pedido) => (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.total_linea, 0);
  const productosDe = (p: Pedido) =>
    (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.cantidad, 0);

  // Últimos 20 pedidos del comercial (el hook puede devolver más).
  const ultimosPedidos = pedidos.slice(0, 20);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View style={{ paddingTop: insets.top + 8 }} className="gap-4 p-4">
        {/* Cabecera */}
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.back()} className="rounded-md p-1 active:bg-accent">
            <ChevronLeft size={24} color={colores.primerPlano} />
          </Pressable>
          <View className="flex-1 gap-0.5">
            <Text className="text-xl font-bold tracking-tight">Detalle del comercial</Text>
            {comercial ? (
              <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <Text className="text-xs text-muted-foreground">
                  {comercial.nombre} {comercial.apellidos ?? ''} · {comercial.email}
                </Text>
                <Badge variant="outline">
                  <Text>
                    {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}
                  </Text>
                </Badge>
              </View>
            ) : null}
          </View>
        </View>

        {cargando ? (
          <View className="items-center py-16">
            <ActivityIndicator color="hsl(24.6 95% 53.1%)" />
          </View>
        ) : error ? (
          <View className="items-center gap-3 py-16">
            <Text className="text-center text-destructive">{error}</Text>
            <Button size="sm" variant="outline" onPress={() => void recargar()}>
              <Text>Reintentar</Text>
            </Button>
          </View>
        ) : !comercial ? (
          <Text className="text-muted-foreground">Comercial no encontrado.</Text>
        ) : (
          <>
            {/* Clientes */}
            <Card className="rounded-[10px]">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Clientes</CardTitle>
              </CardHeader>
              <CardContent className="gap-1">
                {clientes.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">Sin clientes asignados</Text>
                ) : (
                  clientes.map((c, indice) => (
                    <View key={c.id}>
                      {indice > 0 ? <Separator /> : null}
                      {/* Fila de solo lectura: el admin no gestiona la cartera
                          del comercial (esas pantallas le redirigen al panel). */}
                      <View className="active:opacity-80">
                        <View className="gap-1 py-3">
                          <Text className="text-sm font-medium">
                            {c.razon_social ?? `${c.nombre} ${c.apellidos ?? ''}`.trim()}
                          </Text>
                          <Text className="text-xs text-muted-foreground">{c.email}</Text>
                          <View className="flex-row flex-wrap gap-1.5 pt-1">
                            <Badge variant="outline">
                              <Text>
                                {c.descuento_porcentaje > 0
                                  ? `General ${formatPct(c.descuento_porcentaje)}`
                                  : 'Sin descuento general'}
                              </Text>
                            </Badge>
                            <Badge variant="outline">
                              <Text>
                                #{c.nDescuentosProducto}{' '}
                                {c.nDescuentosProducto === 1 ? 'producto' : 'productos'}
                              </Text>
                            </Badge>
                            <Badge variant="outline">
                              <Text>
                                #{c.nDescuentosCombustible}{' '}
                                {c.nDescuentosCombustible === 1 ? 'combustible' : 'combustibles'}
                              </Text>
                            </Badge>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Pedidos del comercial */}
            <Card className="rounded-[10px]">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Pedidos del comercial</CardTitle>
              </CardHeader>
              <CardContent className="gap-2">
                {ultimosPedidos.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">Sin pedidos registrados</Text>
                ) : (
                  ultimosPedidos.map((p) => (
                    <View key={p.id} className="gap-1.5 rounded-md border border-border p-3">
                        <View className="flex-row items-center justify-between gap-2">
                          <View className="flex-row items-center gap-2">
                            <Text className="text-sm font-semibold">
                              Pedido nº {p.numero_pedido}
                            </Text>
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
                      </View>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </View>
    </ScrollView>
  );
}
