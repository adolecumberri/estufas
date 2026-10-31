import { useCallback, useMemo } from 'react';

import { useAuth } from '@/features/auth/use-auth';
import {
  capacidadesDe,
  INICIO_POR_ROL,
  puede as puedeRol,
  rolDesdePerfil,
  type Cap,
  type Rol,
} from '@/shared/seguridad/capacidades';

// Hook único de capacidades para la UI (anillo 3): deriva el rol de la
// sesión/perfil y expone `puede(cap)` memoizado. La autoridad real sigue en
// RLS/RPC; aquí solo se ocultan botones y navegación.
export function usePermisos() {
  const { session, perfil } = useAuth();

  // Sin sesión (o con el perfil aún sin cargar) → rol anónimo.
  const rol = useMemo<Rol>(() => rolDesdePerfil(session ? perfil : null), [session, perfil]);

  const capacidades = useMemo(() => capacidadesDe(rol), [rol]);

  const puede = useCallback((cap: Cap) => puedeRol(rol, cap), [rol]);

  const esAdmin = rol === 'admin';
  // Fase 1: el modo solo lectura coincide con el admin (no compra ni gestiona
  // pedidos/descuentos para sí; su operación vive en el panel /admin).
  const soloLectura = esAdmin;
  const inicio = INICIO_POR_ROL[rol];

  return { rol, puede, capacidades, esAdmin, soloLectura, inicio };
}
