import { Stack } from 'expo-router';

import { GuardRuta } from '@/components/seguridad/guard-ruta';

// Grupo del cliente: pedidos propios. Entran cliente y comercial (crear
// propio / confirmar); el admin queda fuera porque la cascada le retira
// ambas capacidades.
export default function LayoutCliente() {
  return (
    <GuardRuta exige={['pedidos:crear_propio', 'pedidos:confirmar']}>
      <Stack screenOptions={{ headerShown: false }} />
    </GuardRuta>
  );
}
