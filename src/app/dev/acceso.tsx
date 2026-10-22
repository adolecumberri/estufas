// Pantalla SOLO de desarrollo: cambia de usuario con un toque para probar
// roles y reglas de visibilidad sin teclear credenciales (ver
// docs/USUARIOS_PRUEBA.md). Fuera de __DEV__ no existe: redirige al catálogo.
import { Redirect, router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';
import { useColoresIcono } from '@/lib/theme';

interface PerfilDev {
  id: string;
  nombre: string;
  email: string | null;
  password: string | null;
  rol: string;
}

// Usuarios del seed (supabase/seed.sql), mismos que documenta USUARIOS_PRUEBA.md.
const PERFILES: PerfilDev[] = [
  { id: 'anonimo', nombre: 'Anónimo', email: null, password: null, rol: 'sin sesión' },
  {
    id: 'admin@estufas.local',
    nombre: 'Admin',
    email: 'admin@estufas.local',
    password: 'Admin123!',
    rol: 'admin',
  },
  {
    id: 'comercial@estufas.local',
    nombre: 'Comercial Eider + estufas',
    email: 'comercial@estufas.local',
    password: 'Comercial123!',
    rol: 'comercial',
  },
  {
    id: 'fansa@estufas.local',
    nombre: 'Comercial solo Fansa',
    email: 'fansa@estufas.local',
    password: 'ComercialFansa123!',
    rol: 'comercial',
  },
  {
    id: 'ambos@estufas.local',
    nombre: 'Comercial Fansa + Eider',
    email: 'ambos@estufas.local',
    password: 'ComercialAmbos123!',
    rol: 'comercial',
  },
  {
    id: 'cliente@estufas.local',
    nombre: 'Cliente particular',
    email: 'cliente@estufas.local',
    password: 'Cliente123!',
    rol: 'cliente (particular)',
  },
  {
    id: 'empresa@estufas.local',
    nombre: 'Cliente empresa',
    email: 'empresa@estufas.local',
    password: 'Empresa123!',
    rol: 'cliente (empresa)',
  },
  {
    id: 'suelto@estufas.local',
    nombre: 'Cliente sin comercial',
    email: 'suelto@estufas.local',
    password: 'Suelto123!',
    rol: 'cliente (sin comercial)',
  },
];

export default function DevAcceso() {
  const insets = useSafeAreaInsets();
  const colores = useColoresIcono();

  // Perfil en curso (su email, o 'anonimo'): string | null. null = sin petición.
  const [procesando, setProcesando] = React.useState<string | null>(null);
  // Error por perfil, mostrado bajo su propio botón.
  const [errores, setErrores] = React.useState<Record<string, string>>({});

  // En producción esta pantalla no existe: volvemos al catálogo.
  if (!__DEV__) return <Redirect href="/" />;

  const entrar = async (p: PerfilDev) => {
    if (procesando) return;
    setErrores((prev) => ({ ...prev, [p.id]: '' }));
    setProcesando(p.id);
    try {
      if (!p.email) {
        // Anónimo: cierra SOLO la sesión de este dispositivo (los perfiles del
        // seed se comparten entre dispositivos de desarrollo) y vuelve al
        // catálogo público. Si el cierre falla, nos quedamos en esta pantalla
        // mostrando el error bajo el perfil.
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) {
          setErrores((prev) => ({ ...prev, [p.id]: error.message }));
          return;
        }
        router.replace('/');
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: p.email,
        password: p.password ?? '',
      });
      if (error) {
        setErrores((prev) => ({ ...prev, [p.id]: error.message }));
        return;
      }
      // El listener de auth-context refresca sesión y perfil; vamos al catálogo.
      router.replace('/');
    } catch (e) {
      setErrores((prev) => ({
        ...prev,
        [p.id]: e instanceof Error ? e.message : 'Error inesperado al cambiar de perfil',
      }));
    } finally {
      setProcesando(null);
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center gap-2 px-4 pb-2">
        <Pressable onPress={() => router.back()} className="rounded-md p-1 active:bg-accent">
          <ChevronLeft size={24} color={colores.primerPlano} />
        </Pressable>
        <Text className="text-xl font-bold tracking-tight">Acceso rápido (dev)</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 32 + insets.bottom }}
      >
        <Text className="text-xs text-muted-foreground">
          Cambia de usuario con un toque para probar roles y visibilidad (ver docs/USUARIOS_PRUEBA.md).
        </Text>

        {PERFILES.map((p) => (
          <View key={p.id} className="gap-1">
            <Pressable
              disabled={procesando !== null}
              onPress={() => void entrar(p)}
              className="active:opacity-80"
            >
              <Card className="rounded-[10px] p-3">
                <CardContent className="gap-1 px-3">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="font-medium">{p.nombre}</Text>
                    {procesando === p.id && (
                      <ActivityIndicator color="hsl(124.3 17.7% 31%)" />
                    )}
                  </View>
                  <Text className="text-sm">{p.email ?? 'Sin sesión'}</Text>
                  <Text className="text-xs text-muted-foreground">{p.rol}</Text>
                </CardContent>
              </Card>
            </Pressable>
            {errores[p.id] ? (
              <Text className="px-3 text-xs text-destructive">{errores[p.id]}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
