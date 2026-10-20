import type { Session } from '@supabase/supabase-js';
import * as React from 'react';

import { supabase } from '@/lib/supabase';
import type { PerfilUsuario, TipoCliente } from '@/lib/types';

export interface DatosRegistro {
  tipo_cliente: TipoCliente;
  nombre: string;
  apellidos?: string;
  telefono?: string;
  razon_social?: string;
  nif_cif?: string;
}

interface AuthContextValue {
  session: Session | null;
  perfil: PerfilUsuario | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, datos: DatosRegistro) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [perfil, setPerfil] = React.useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refreshPerfil = React.useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    setSession(s);
    if (!s?.user) {
      setPerfil(null);
      setLoading(false);
      return;
    }
    const { data: fila } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', s.user.id)
      .single();
    setPerfil((fila as PerfilUsuario) ?? null);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refreshPerfil();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) setPerfil(null);
      else void refreshPerfil();
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshPerfil]);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    await refreshPerfil();
    return { error: null };
  }, [refreshPerfil]);

  const signUp = React.useCallback(async (email: string, password: string, datos: DatosRegistro) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          rol: 'cliente',
          tipo_cliente: datos.tipo_cliente,
          nombre: datos.nombre,
          apellidos: datos.apellidos ?? null,
          telefono: datos.telefono ?? null,
          razon_social: datos.razon_social ?? null,
          nif_cif: datos.nif_cif ?? null,
        },
      },
    });
    if (error) return { error: error.message };
    // Sin confirmación de email (dev), la sesión ya existe; refresca el perfil.
    if (data.session) await refreshPerfil();
    return { error: null };
  }, [refreshPerfil]);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    setPerfil(null);
  }, []);

  const value = React.useMemo(
    () => ({ session, perfil, loading, signIn, signUp, signOut, refreshPerfil }),
    [session, perfil, loading, signIn, signUp, signOut, refreshPerfil]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext debe usarse dentro de <AuthProvider>');
  return ctx;
}
