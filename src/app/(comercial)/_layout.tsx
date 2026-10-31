import { Stack } from 'expo-router';

import { GuardRuta } from '@/components/seguridad/guard-ruta';

// Grupo comercial: cartera de clientes. El comercial gestiona; el admin
// entra EN LECTURA (cartera:ver_clientes por cascada) — en fase 4 podrá
// abrir una solicitud para un cliente desde aquí.
export default function LayoutComercial() {
  return (
    <GuardRuta exige="cartera:ver_clientes">
      <Stack screenOptions={{ headerShown: false }} />
    </GuardRuta>
  );
}
