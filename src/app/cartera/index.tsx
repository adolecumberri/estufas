import { Redirect, router, useFocusEffect } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavInferior } from '@/components/navegacion/nav-inferior';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { TIPOS_CLIENTE } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import { useCartera } from '@/hooks/use-comercial';
import { usePedidos } from '@/hooks/use-pedidos';
import { formatEUR, formatPct } from '@/lib/format';
import { useColoresIcono } from '@/lib/theme';

export default function Cartera() {
  const insets = useSafeAreaInsets();
  const colores = useColoresIcono();
  const { session, perfil, cerrarSesion } = useAuth();
  const { clientes, cargando, error } = useCartera();
  const { pedidos, cargando: cargandoPedidos, error: errorPedidos, recargar } = usePedidos();

  // La primera carga ya la hace el hook al montar; en los siguientes enfoques se refresca.
  const primerEnfoque = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (primerEnfoque.current) {
        primerEnfoque.current = false;
        return;
      }
      void recargar();
    }, [recargar])
  );

  if (!session) return <Redirect href="/acceso" />;
  if (perfil && perfil.rol !== 'comercial' && perfil.rol !== 'admin') {
    return <Redirect href="/pedidos" />;
  }

  const pendientes = pedidos.filter((p) => p.estado === 'solicitado');

  return (
    <>
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}>
        <View style={{ paddingTop: insets.top + 8 }} className="gap-4 p-4">
          <View className="flex-row items-center justify-between">
            <View className="gap-1">
              <Text className="text-xl font-bold tracking-tight">Cartera</Text>
              <Text className="text-xs text-muted-foreground">{perfil?.email}</Text>
            </View>
            <Pressable onPress={() => void cerrarSesion()} className="rounded-md p-2 active:bg-accent">
              <LogOut size={20} color={colores.tenue} />
            </Pressable>
          </View>

          {/* Pedidos pendientes de confirmar (visibles para este comercial vía RLS) */}
          <Card className="gap-2 rounded-[10px] p-3">
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

          {cargando ? (
            <View className="items-center py-16">
              <ActivityIndicator color="hsl(24.6 95% 53.1%)" />
            </View>
          ) : error ? (
            <Text className="text-muted-foreground">{error}</Text>
          ) : clientes.length === 0 ? (
            <Text className="text-muted-foreground">No tienes clientes asignados todavía.</Text>
          ) : (
            <View className="gap-3">
              {clientes.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => router.push(`/cartera/${c.id}`)}
                  className="active:opacity-80"
                >
                  <Card className="rounded-[10px]">
                    <CardContent className="gap-2">
                      <View className="flex-row items-center justify-between">
                        <Text className="font-semibold">
                          {c.razon_social ?? `${c.nombre} ${c.apellidos ?? ''}`.trim()}
                        </Text>
                        <Badge variant="outline">
                          <Text>{c.tipo_cliente ? TIPOS_CLIENTE[c.tipo_cliente].etiqueta : ''}</Text>
                        </Badge>
                      </View>
                      <Text className="text-xs text-muted-foreground">{c.email}</Text>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs text-muted-foreground">Descuento general</Text>
                        <Text className="text-sm font-medium">{formatPct(c.descuento_porcentaje)}</Text>
                      </View>
                    </CardContent>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <NavInferior activa="cartera" />
    </>
  );
}
