import { Stack, usePathname } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavInferior } from '@/shared/navegacion/nav-inferior';
import { GuardRuta } from '@/shared/seguridad/guard-ruta';
import { usePermisos } from '@/shared/seguridad/use-permisos';

// Grupo de pedidos: entran todos los roles con `pedidos:ver` — el cliente
// (crea los suyos), el comercial (confirma los de su cartera) y el admin
// (pleno acceso operativo sobre pedidos de clientes, decisión 10/11/2026).
// El anónimo no tiene pedidos:ver y rebota a /acceso.
//
// Shell del grupo (F3): la LISTA (/pedidos) lleva tab bar; el DETALLE
// (/pedidos/[id]) NO la muestra (hoy no la tenía y se mantiene el
// comportamiento: pantalla con cabecera propia y back contextual — decisión
// documentada). Se distingue por pathname dentro del grupo, que sí está
// dentro del contexto de navegación.
//
// El admin solo llega aquí SCOPEADO (?comercial=<id>): su barra muestra
// Catálogo + Gestión (NavInferior filtra Pedidos/Cartera para admin) y la
// pestaña activa es "Gestión", no "Pedidos" (feedback 10/11: en rutas
// scoped la tab bar no debe presentar Pedidos/Cartera como globales).
function ShellPedidos() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { esAdmin } = usePermisos();
  const esLista = pathname === '/pedidos';
  const activaBarra = esAdmin ? 'gestion' : 'pedidos';
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1" style={esLista ? { paddingBottom: 64 + insets.bottom } : undefined}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      {esLista && <NavInferior activa={activaBarra} />}
    </View>
  );
}

export default function LayoutCliente() {
  return (
    <GuardRuta exige="pedidos:ver">
      <ShellPedidos />
    </GuardRuta>
  );
}
