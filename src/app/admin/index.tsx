import { Redirect, router } from 'expo-router';
import { Boxes, LogOut, Percent, Users } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/hooks/use-auth';
import { useColoresIcono } from '@/lib/theme';

const SECCIONES = [
  { titulo: 'Productos', descripcion: 'Publicación y precios', icono: Boxes, ruta: '/admin/productos' },
  { titulo: 'Promociones', descripcion: 'Descuentos generales de tienda', icono: Percent, ruta: '/admin/promociones' },
  { titulo: 'Usuarios', descripcion: 'Roles, comerciales y descuentos', icono: Users, ruta: '/admin/usuarios' },
] as const;

export default function Admin() {
  const insets = useSafeAreaInsets();
  const { session, perfil, cerrarSesion } = useAuth();
  const colores = useColoresIcono();

  if (!session) return <Redirect href="/acceso" />;
  if (perfil && perfil.rol !== 'admin') return <Redirect href="/pedidos" />;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center justify-between px-4 pb-4">
        <Text className="text-xl font-bold tracking-tight">Administración</Text>
        <Pressable onPress={() => void cerrarSesion()} className="rounded-md p-2 active:bg-accent">
          <LogOut size={20} color={colores.tenue} />
        </Pressable>
      </View>
      <View className="gap-3 px-4">
        {SECCIONES.map((s) => (
          <Pressable key={s.ruta} onPress={() => router.push(s.ruta)} className="active:opacity-80">
            <Card>
              <CardContent className="flex-row items-center gap-3">
                <s.icono size={20} color={colores.primario} />
                <View className="flex-1">
                  <CardTitle className="text-base">{s.titulo}</CardTitle>
                  <Text className="text-xs text-muted-foreground">{s.descripcion}</Text>
                </View>
              </CardContent>
            </Card>
          </Pressable>
        ))}
        <Pressable onPress={() => router.replace('/')} className="pt-2">
          <Text className="text-center text-sm text-muted-foreground">Volver al catálogo</Text>
        </Pressable>
      </View>
    </View>
  );
}
