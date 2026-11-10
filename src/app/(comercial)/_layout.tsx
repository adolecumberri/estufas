import { Stack } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavInferior } from '@/shared/navegacion/nav-inferior';
import { GuardRuta } from '@/shared/seguridad/guard-ruta';
import { usePermisos } from '@/shared/seguridad/use-permisos';

// Grupo comercial: cartera de clientes. El comercial gestiona; el admin entra
// con pleno acceso operativo (S0, decisión 10/11/2026) y reutiliza estas
// rutas con alcance por query (?comercial=<id>).
//
// Shell del grupo (F3): tab bar fija en TODAS las rutas del grupo + padding
// inferior reservado. Para el admin (siempre scoped) la barra muestra
// Catálogo + Gestión con "Gestión" activa — Pedidos/Cartera no se presentan
// como globales (feedback 10/11).
function ShellCartera() {
  const insets = useSafeAreaInsets();
  const { esAdmin } = usePermisos();
  const activaBarra = esAdmin ? 'gestion' : 'cartera';
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1" style={{ paddingBottom: 64 + insets.bottom }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <NavInferior activa={activaBarra} />
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
