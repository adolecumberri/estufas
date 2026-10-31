import { Redirect, type Href } from 'expo-router';
import * as React from 'react';

import { useAuth } from '@/features/auth/use-auth';
import { usePermisos } from '@/shared/seguridad/use-permisos';
import type { Cap } from '@/shared/seguridad/capacidades';

// Capacidades del anónimo (catálogo general): los grupos que SOLO exigen
// estas no requieren sesión aunque `exigeSesion` quede a true (p. ej. el
// carrito, que el anónimo puede llenar).
const CAPS_ANONIMAS: Cap[] = ['catalogo:ver_general', 'proveedor:cambiar', 'carrito:usar', 'auth:login'];

// Guard de grupo de rutas (anillo 2, page-safe): exige al menos UNA de las
// capacidades indicadas. Sin sesión en un grupo que la requiere → /acceso;
// sin ninguna capacidad → pantalla de inicio del rol (usePermisos().inicio).
// Nunca sustituye a RLS/RPC (anillo 1).
export function GuardRuta({
  exige,
  exigeSesion = true,
  children,
}: {
  exige: Cap | Cap[];
  exigeSesion?: boolean;
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const { puede, inicio } = usePermisos();

  const caps = Array.isArray(exige) ? exige : [exige];

  // Grupo público (exigeSesion=false): sin restricciones.
  if (!exigeSesion) return <>{children}</>;

  // El grupo requiere sesión si alguna de sus capacidades no es del anónimo.
  const requiereSesion = !caps.every((c) => CAPS_ANONIMAS.includes(c));
  if (requiereSesion && !session) return <Redirect href="/acceso" />;

  // Sin ninguna de las capacidades exigidas → inicio del rol. Los valores de
  // INICIO_POR_ROL son rutas válidas de la app (tipadas en router.d.ts).
  if (!caps.some((c) => puede(c))) return <Redirect href={inicio as Href} />;

  return <>{children}</>;
}
