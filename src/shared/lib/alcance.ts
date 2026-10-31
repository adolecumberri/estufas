import * as React from 'react';

import { useAuth } from '@/features/auth/use-auth';
import { supabase } from '@/shared/lib/supabase';
import type { PerfilUsuario } from '@/shared/lib/types';

// ---------------------------------------------------------------------------
// Alcance del cliente objetivo (anillo 3 de ARQUITECTURA_ROLES.md §6).
//
// Decide si el usuario actual puede operar sobre un cliente concreto ANTES de
// consultar su cartera, pedidos o descuentos, para que ningún hook lea el id
// de la URL "a pelo" y para que los errores sean legibles ('Sin acceso a este
// cliente').
//
// Por qué esto NO sustituye a RLS (anillo 3 vs anillo 1): esta comprobación
// vive en el cliente y cualquiera podría saltársela; el anillo 1 (RLS/RPC del
// backend) es el que realmente impide leer o escribir datos ajenos. Aquí solo
// se evita trabajo inútil y se mejora la UX del rechazo.
// ---------------------------------------------------------------------------

export type AlcanceCliente = 'propio' | 'cartera' | 'admin' | null;

// Fila mínima que se consulta para validar el alcance de un comercial/admin.
interface FilaCliente {
  id: string;
  id_comercial: string | null;
  rol: string;
}

export async function resolverAlcanceCliente(
  clienteId: string,
  perfil: PerfilUsuario | null
): Promise<{ clienteId: string | null; alcance: AlcanceCliente; error: string | null }> {
  if (!perfil) {
    return { clienteId: null, alcance: null, error: 'Inicia sesión para continuar.' };
  }

  // Cliente: solo puede operar sobre sí mismo (sin query).
  if (perfil.rol === 'cliente') {
    if (clienteId !== perfil.id) {
      return { clienteId: null, alcance: null, error: 'Sin acceso a este cliente' };
    }
    return { clienteId, alcance: 'propio', error: null };
  }

  // Comercial: el cliente debe existir y pertenecer a su cartera.
  if (perfil.rol === 'comercial') {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, id_comercial, rol')
      .eq('id', clienteId)
      .maybeSingle();
    if (error) {
      return { clienteId: null, alcance: null, error: error.message };
    }
    const objetivo = data as FilaCliente | null;
    if (!objetivo || objetivo.rol !== 'cliente' || objetivo.id_comercial !== perfil.id) {
      return { clienteId: null, alcance: null, error: 'Sin acceso a este cliente' };
    }
    return { clienteId, alcance: 'cartera', error: null };
  }

  // Admin: lectura total, permitido si el usuario existe y es cliente.
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, id_comercial, rol')
    .eq('id', clienteId)
    .maybeSingle();
  if (error) {
    return { clienteId: null, alcance: null, error: error.message };
  }
  const objetivo = data as FilaCliente | null;
  if (!objetivo || objetivo.rol !== 'cliente') {
    return { clienteId: null, alcance: null, error: 'El usuario no es un cliente' };
  }
  return { clienteId, alcance: 'admin', error: null };
}

// Hook que resuelve el alcance sobre un cliente objetivo cada vez que cambia
// el id (o el perfil). El caso "propio" no hace ninguna query: se compara
// clienteId con perfil.id directamente dentro de resolverAlcanceCliente.
export function useClienteObjetivo(clienteId: string | null | undefined) {
  const { perfil } = useAuth();
  const [estado, setEstado] = React.useState<{
    clienteId: string | null;
    alcance: AlcanceCliente;
    error: string | null;
  }>({ clienteId: null, alcance: null, error: null });
  const [cargando, setCargando] = React.useState(false);

  React.useEffect(() => {
    let cancelado = false;
    if (!clienteId) {
      setEstado({ clienteId: null, alcance: null, error: null });
      setCargando(false);
      return;
    }
    setCargando(true);
    void resolverAlcanceCliente(clienteId, perfil).then((res) => {
      if (cancelado) return;
      setEstado(res);
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [clienteId, perfil]);

  const permitido = estado.alcance !== null;
  return { ...estado, cargando, permitido };
}
