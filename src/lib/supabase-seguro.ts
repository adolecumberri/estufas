import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Wrapper de llamadas RPC (anillo 3 de ARQUITECTURA_ROLES.md §6: "cada
// llamada verificada" en la app).
//
// Normaliza el error a texto y marca los de PERMISO (código SQL 42501 o
// mensajes típicos de RLS) para que la UI pueda reaccionar con un aviso o una
// redirección en vez de mostrar un error técnico.
//
// Esto NO sustituye al anillo 1: el backend (RLS + RPC) sigue siendo la
// fuente de verdad y revalida cada llamada. Aquí solo se mejora el manejo de
// errores en el cliente.
// ---------------------------------------------------------------------------

export interface ResultadoRpc<T> {
  data: T | null;
  error: string | null;
  // true cuando el error es de autorización (42501 / mensaje de permiso).
  esPermiso: boolean;
}

const PATRON_PERMISO =
  /permission denied|no autorizado|not authorized|violates row-level security/i;

export async function rpcSegura<T = unknown>(
  nombre: string,
  params: Record<string, unknown> = {}
): Promise<ResultadoRpc<T>> {
  const { data, error } = await supabase.rpc(nombre, params);
  if (!error) {
    return { data: (data as T) ?? null, error: null, esPermiso: false };
  }
  const mensaje = error.message ?? 'Error desconocido al llamar al servidor.';
  const esPermiso = error.code === '42501' || PATRON_PERMISO.test(mensaje);
  return { data: null, error: mensaje, esPermiso };
}
