import { router } from 'expo-router';
import { ChevronLeft, Factory, Users } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { volverA } from '@/lib/navegacion';
import { useColoresIcono } from '@/lib/theme';

const SECCIONES = [
  { titulo: 'Comerciales', descripcion: 'Comerciales, sus clientes y accesos a proveedores', icono: Users, ruta: '/admin/comerciales' },
  { titulo: 'Proveedores', descripcion: 'Catálogo multi-empresa y comerciales', icono: Factory, ruta: '/admin/proveedores' },
] as const;

export default function Admin() {
  const insets = useSafeAreaInsets();
  const colores = useColoresIcono();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 8 }}>
      {/* Cabecera con volver (al catálogo si no hay historial). */}
      <View className="flex-row items-center gap-2 px-4 pb-4">
        <Pressable
          onPress={() => volverA('/')}
          accessibilityRole="button"
          accessibilityLabel="Volver al catálogo"
          className="rounded-md p-1 active:bg-accent"
        >
          <ChevronLeft size={24} color={colores.primerPlano} />
        </Pressable>
        <Text className="text-xl font-bold tracking-tight">Administración</Text>
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
