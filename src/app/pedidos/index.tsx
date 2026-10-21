import { Redirect, router } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavInferior } from '@/components/navegacion/nav-inferior';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { ESTADOS_PEDIDO, ROLES } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import { useCartera } from '@/hooks/use-comercial';
import { usePedidos } from '@/hooks/use-pedidos';
import { formatEUR, formatFecha } from '@/lib/format';
import { useColoresIcono } from '@/lib/theme';

export default function Pedidos() {
  const insets = useSafeAreaInsets();
  const { session, perfil, cerrarSesion } = useAuth();
  const { pedidos, cargando: cargandoPedidos, error: errorPedidos } = usePedidos();
  const { clientes } = useCartera();
  const colores = useColoresIcono();

  if (!session) return <Redirect href="/acceso" />;

  const esComercialOAdmin = perfil?.rol === 'comercial' || perfil?.rol === 'admin';
  const pendientes = pedidos.filter((p) => p.estado === 'solicitado');

  const varianteEstado = (estado: keyof typeof ESTADOS_PEDIDO) => {
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

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center justify-between px-4 pb-2">
        <View className="gap-1">
          <Text className="text-xl font-bold tracking-tight">Pedidos</Text>
          <Text className="text-xs text-muted-foreground">
            {perfil ? ROLES[perfil.rol].etiqueta : ''} · {perfil?.email}
          </Text>
        </View>
        <Pressable onPress={() => void cerrarSesion()} className="rounded-md p-2 active:bg-accent">
          <LogOut size={20} color={colores.tenue} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 + insets.bottom }}
      >
        {/* Pedidos pendientes de confirmar (visibles para este comercial vía RLS) */}
        {esComercialOAdmin && (
          <Card className="mx-4 mb-3 gap-2 rounded-[10px] p-3">
            <CardHeader className="px-3 pt-1">
              <CardTitle className="text-base">Pedidos pendientes de confirmar</CardTitle>
            </CardHeader>
            <CardContent className="gap-3 px-3">
              {cargandoPedidos ? (
                <ActivityIndicator color="hsl(24.6 95% 53.1%)" />
              ) : errorPedidos ? (
                <Text className="text-muted-foreground">{errorPedidos}</Text>
              ) : pendientes.length === 0 ? (
                <Text className="text-muted-foreground">No hay pedidos pendientes de confirmar.</Text>
              ) : (
                pendientes.map((p, indice) => {
                  const total = (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.total_linea, 0);
                  const cliente = clientes.find((c) => c.id === p.cliente_id);
                  const nombreCliente = cliente
                    ? (cliente.razon_social ?? `${cliente.nombre} ${cliente.apellidos ?? ''}`.trim())
                    : null;
                  return (
                    <View key={p.id} className="gap-3">
                      {indice > 0 && <Separator />}
                      <View className="flex-row items-center justify-between gap-3">
                        <View className="flex-1 gap-0.5">
                          <Text className="text-sm font-medium">Pedido nº {p.numero_pedido}</Text>
                          {nombreCliente && (
                            <Text className="text-xs text-muted-foreground">{nombreCliente}</Text>
                          )}
                          <Text className="text-sm font-semibold">{formatEUR(total)}</Text>
                        </View>
                        <Button size="sm" onPress={() => router.push(`/pedidos/${p.id}`)}>
                          <Text>Confirmar</Text>
                        </Button>
                      </View>
                    </View>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        {cargandoPedidos ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="hsl(24.6 95% 53.1%)" />
          </View>
        ) : errorPedidos ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Text className="text-center text-muted-foreground">{errorPedidos}</Text>
          </View>
        ) : pedidos.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-4 px-8">
            <Text className="text-center text-muted-foreground">Aún no tienes pedidos.</Text>
            <Button onPress={() => router.replace('/')}>
              <Text>Ver catálogo</Text>
            </Button>
          </View>
        ) : (
          <View className="gap-3 p-4">
            {pedidos.map((p) => {
              const total = (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.total_linea, 0);
              const numLineas = (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.cantidad, 0);
              return (
                <Pressable key={p.id} onPress={() => router.push(`/pedidos/${p.id}`)} className="active:opacity-80">
                  <Card className="rounded-[10px]">
                    <CardContent className="gap-2">
                      <View className="flex-row items-center justify-between">
                        <Text className="font-medium">Pedido nº {p.numero_pedido}</Text>
                        <Badge variant={varianteEstado(p.estado)}>
                          <Text>{ESTADOS_PEDIDO[p.estado].etiqueta}</Text>
                        </Badge>
                      </View>
                      <Text className="text-xs text-muted-foreground">{formatFecha(p.fecha_pedido)}</Text>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-muted-foreground">
                          {numLineas} {numLineas === 1 ? 'producto' : 'productos'}
                        </Text>
                        <Text className="font-bold">{formatEUR(total)}</Text>
                      </View>
                    </CardContent>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <NavInferior activa="pedidos" />
    </View>
  );
}
