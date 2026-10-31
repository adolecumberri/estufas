import { Stack } from 'expo-router';

import { GuardRuta } from '@/shared/seguridad/guard-ruta';

// Grupo público: catálogo general, acceso y registro. Sin restricciones
// (el anónimo entra de pleno derecho).
export default function LayoutPublico() {
  return (
    <GuardRuta exige={[]} exigeSesion={false}>
      <Stack screenOptions={{ headerShown: false }} />
    </GuardRuta>
  );
}
