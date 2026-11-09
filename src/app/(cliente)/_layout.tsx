import { Stack } from 'expo-router';

import { GuardRuta } from '@/shared/seguridad/guard-ruta';

// Grupo de pedidos: entran todos los roles con `pedidos:ver` — el cliente
// (crea los suyos), el comercial (confirma los de su cartera) y el admin
// (pleno acceso operativo sobre pedidos de clientes, decisión 10/11/2026).
// El anónimo no tiene pedidos:ver y rebota a /acceso.
export default function LayoutCliente() {
  return (
    <GuardRuta exige="pedidos:ver">
      <Stack screenOptions={{ headerShown: false }} />
    </GuardRuta>
  );
}
