import { Stack } from 'expo-router';

import { GuardRuta } from '@/components/seguridad/guard-ruta';

// Grupo del carrito: el anónimo PUEDE llenar el carrito local (no se le
// redirige al login); el admin entra para preparar la solicitud de un cliente
// (pedidos:crear_para_cliente). exigeSesion=false porque con la lista OR la
// capacidad del admin no es "anónima" y el guard redirigiría al anónimo a
// /acceso; con la comprobación desactivada entran todos los roles que tocan
// este grupo (anónimo, cliente, comercial y admin) y el resto lo protege RLS.
export default function LayoutCarrito() {
  return (
    <GuardRuta exige={['carrito:usar', 'pedidos:crear_para_cliente']} exigeSesion={false}>
      <Stack screenOptions={{ headerShown: false }} />
    </GuardRuta>
  );
}
