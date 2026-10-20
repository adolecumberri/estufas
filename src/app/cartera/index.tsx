import { Redirect, router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { TIPOS_CLIENTE } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import { useCartera } from '@/hooks/use-comercial';
import { formatPct } from '@/lib/format';

export default function Cartera() {
  const insets = useSafeAreaInsets();
  const { session, perfil } = useAuth();
  const { clientes, cargando, error } = useCartera();

  if (!session) return <Redirect href="/acceso" />;
  if (perfil && perfil.rol !== 'comercial' && perfil.rol !== 'admin') {
    return <Redirect href="/pedidos" />;
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ paddingTop: insets.top + 8 }} className="gap-4 p-4">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.replace('/')} className="rounded-md p-1 active:bg-accent">
            <ChevronLeft size={24} className="text-foreground" />
          </Pressable>
          <Text className="text-xl font-bold tracking-tight">Cartera de clientes</Text>
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
              <Pressable key={c.id} onPress={() => router.push(`/cartera/${c.id}`)} className="active:opacity-80">
                <Card>
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
  );
}
