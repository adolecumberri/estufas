import { Stack } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavInferior } from '@/shared/navegacion/nav-inferior';
import { GuardRuta } from '@/shared/seguridad/guard-ruta';

// Grupo de gestión (antes /admin, renombrado 10/11/2026 por decisión del
// usuario): comerciales y proveedores. Solo el admin (admin:acceder).
//
// Shell del grupo (F2): TODA pantalla de /gestion/** recibe aquí la tab bar
// fija con "Gestión" activa, sin que cada pantalla la monte a mano; la cuenta
// va por defecto en ScreenHeader. El contenedor reserva por abajo el alto de
// la barra + safe area para que el contenido no quede tapado. El marco de
// escritorio (max-w) ya lo aplica el layout raíz de la app.
function ShellGestion() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1" style={{ paddingBottom: 64 + insets.bottom }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <NavInferior activa="gestion" />
    </View>
  );
}

export default function LayoutGestion() {
  return (
    <GuardRuta exige="admin:acceder">
      <ShellGestion />
    </GuardRuta>
  );
}
