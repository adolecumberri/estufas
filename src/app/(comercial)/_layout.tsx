import { Stack } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavInferior } from '@/shared/navegacion/nav-inferior';
import { GuardRuta } from '@/shared/seguridad/guard-ruta';

// Grupo comercial: cartera de clientes. El comercial gestiona; el admin entra
// con pleno acceso operativo (S0, decisión 10/11/2026) y reutiliza estas
// rutas con alcance por query (?comercial=<id>).
//
// Shell del grupo (F3): tab bar fija con Cartera activo en TODAS las rutas
// del grupo (lista y ficha de cliente) + padding inferior reservado. La
// cuenta va por defecto en ScreenHeader de cada pantalla.
function ShellCartera() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1" style={{ paddingBottom: 64 + insets.bottom }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <NavInferior activa="cartera" />
    </View>
  );
}

export default function LayoutComercial() {
  return (
    <GuardRuta exige="cartera:ver_clientes">
      <ShellCartera />
    </GuardRuta>
  );
}
