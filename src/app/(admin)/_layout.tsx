import { Stack } from 'expo-router';

import { GuardRuta } from '@/components/seguridad/guard-ruta';

// Grupo admin: panel de administración (comerciales, proveedores, y las
// pantallas de gestión heredadas). Solo el admin.
export default function LayoutAdmin() {
  return (
    <GuardRuta exige="admin:acceder">
      <Stack screenOptions={{ headerShown: false }} />
    </GuardRuta>
  );
}
