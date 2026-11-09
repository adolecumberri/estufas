import { Stack } from 'expo-router';
import * as React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavInferior } from '@/shared/navegacion/nav-inferior';
import { GuardRuta } from '@/shared/seguridad/guard-ruta';

// Grupo del carrito: el anónimo PUEDE llenar el carrito local (no se le
// redirige al login); el admin entra para preparar la solicitud de un cliente
// (pedidos:crear_para_cliente). exigeSesion=false porque con la lista OR la
// capacidad del admin no es "anónima" y el guard redirigiría al anónimo a
// /acceso; con la comprobación desactivada entran todos los roles que tocan
// este grupo (anónimo, cliente, comercial y admin) y el resto lo protege RLS.
//
// Shell del grupo (F3): tab bar fija con Solicitud activo + padding inferior.
// El anónimo ve su rama anónima (Catálogo + Iniciar sesión) y el punto del
// carrito en Solicitud sigue funcionando (lo calcula NavInferior).
function ShellCarrito() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1" style={{ paddingBottom: 64 + insets.bottom }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <NavInferior activa="solicitud" />
    </View>
  );
}

export default function LayoutCarrito() {
  return (
    <GuardRuta exige={['carrito:usar', 'pedidos:crear_para_cliente']} exigeSesion={false}>
      <ShellCarrito />
    </GuardRuta>
  );
}
