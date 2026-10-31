import { router } from 'expo-router';

// Vuelve atrás si hay historial de navegación; si no (entrada directa por URL,
// recarga en web, deep link...) navega a una ruta de respaldo. Evita el aviso
// "The action 'GO_BACK' was not handled by any navigator".
export function volverA(respaldo: string): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  // Las rutas de respaldo son literales válidas de la app; el cast permite
  // usarla desde fuera de los tipos generados de expo-router.
  router.replace(respaldo as never);
}
