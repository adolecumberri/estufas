import { Redirect, router } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavInferior } from '@/components/navegacion/nav-inferior';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { ESTADOS_PEDIDO, ROLES } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import { usePedidos } from '@/hooks/use-pedidos';
import { formatEUR, formatFecha } from '@/lib/format';

export default function Pedidos() {
  const insets = useSafeAreaInsets();
  const { session, perfil, cerrarSesion } = useAuth();
  const { pedidos, cargando, error } = usePedidos();

  if (!session) return <Redirect href="/acceso" />;

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
          <LogOut size={20} className="text-muted-foreground" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 + insets.bottom }}
      >
        {cargando ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="hsl(24.6 95% 53.1%)" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Text className="text-center text-muted-foreground">{error}</Text>
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
