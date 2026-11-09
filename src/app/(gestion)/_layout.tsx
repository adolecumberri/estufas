import { Stack } from 'expo-router';

import { GuardRuta } from '@/shared/seguridad/guard-ruta';

// Grupo de gestión (antes /admin, renombrado 10/11/2026 por decisión del
// usuario): comerciales y proveedores. Solo el admin (admin:acceder).
export default function LayoutGestion() {
  return (
    <GuardRuta exige="admin:acceder">
      <Stack screenOptions={{ headerShown: false }} />
    </GuardRuta>
  );
}
