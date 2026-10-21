import { Redirect, router } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavInferior } from '@/components/navegacion/nav-inferior';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { TIPOS_CLIENTE } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import { useCartera } from '@/hooks/use-comercial';
import { formatPct } from '@/lib/format';
import { useColoresIcono } from '@/lib/theme';

export default function Cartera() {
  const insets = useSafeAreaInsets();
  const colores = useColoresIcono();
  const { session, perfil, cerrarSesion } = useAuth();
  const { clientes, cargando, error } = useCartera();

  if (!session) return <Redirect href="/acceso" />;
  if (perfil && perfil.rol !== 'comercial' && perfil.rol !== 'admin') {
    return <Redirect href="/pedidos" />;
  }

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
