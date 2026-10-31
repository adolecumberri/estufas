import { AUTH_ERRORS } from '@/shared/constantes';
import { useAuthContext } from '@/features/auth/contexto';

// Único punto de acceso a la sesión/perfil desde las pantallas.
export function useAuth() {
  const { session, perfil, loading, signIn, signUp, signOut, refreshPerfil } = useAuthContext();

  const iniciarSesion = async (email: string, password: string): Promise<string | null> => {
    const { error } = await signIn(email.trim().toLowerCase(), password);
    return error ? (AUTH_ERRORS[error] ?? error) : null;
  };

  const registrar = async (
    email: string,
    password: string,
    datos: Parameters<typeof signUp>[2]
  ): Promise<string | null> => {
    const { error } = await signUp(email.trim().toLowerCase(), password, datos);
    return error ? (AUTH_ERRORS[error] ?? error) : null;
  };

  return {
    session,
    perfil,
    loading,
    iniciarSesion,
    registrar,
    cerrarSesion: signOut,
    refreshPerfil,
  };
}
