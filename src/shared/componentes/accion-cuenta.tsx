import { router } from 'expo-router';
import { LogOut, UserRound } from 'lucide-react-native';
import * as React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/use-auth';
import { usePermisos } from '@/shared/seguridad/use-permisos';
import { Button } from '@/shared/ui/button';
import { Text } from '@/shared/ui/text';
import { ROLES } from '@/shared/constantes';
import { supabase } from '@/shared/lib/supabase';
import { useColoresIcono } from '@/shared/lib/theme';

// Acción de cuenta para el slot `accion` de ScreenHeader: avatar con
// iniciales que abre una hoja con la info del usuario, "Mi cuenta" y
// "Cerrar sesión" (misma semántica de cierre local que el drawer del
// catálogo, nav-lateral.tsx). Devuelve al flujo admin el acceso a la cuenta
// que perdió al no existir cabecera global.
export function AccionCuenta() {
  const insets = useSafeAreaInsets();
  const colores = useColoresIcono();
  const { session, perfil } = useAuth();
  const { puede } = usePermisos();
  const [abierta, setAbierta] = React.useState(false);

  const destinoCuenta = () => {
    if (puede('admin:acceder')) return '/admin';
    if (puede('cartera:ver_clientes')) return '/cartera';
    return '/pedidos';
  };

  const cerrarSesionLocal = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) return;
      setAbierta(false);
    } catch {
      // sin efecto: la sesión se mantiene y la hoja queda abierta
    }
  };

  const iniciales = perfil
    ? `${perfil.nombre.trim().charAt(0)}${(perfil.apellidos ?? '').trim().charAt(0) || perfil.nombre.trim().charAt(0)}`.toUpperCase()
    : '?';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cuenta de usuario"
        hitSlop={8}
        onPress={() => setAbierta(true)}
        className="h-9 w-9 items-center justify-center rounded-full border border-border bg-muted active:bg-accent"
      >
        <Text className="text-sm font-semibold">{iniciales}</Text>
      </Pressable>

      <Modal
        transparent
        animationType="fade"
        visible={abierta}
        onRequestClose={() => setAbierta(false)}
      >
        <View className="flex-1 justify-end">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú de cuenta"
            className="absolute inset-0 bg-black/50"
            onPress={() => setAbierta(false)}
          />
          <View
            className="gap-3 rounded-t-lg border-t border-border bg-background p-4"
            style={{ paddingBottom: insets.bottom + 8 }}
          >
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full border border-border bg-muted">
                <Text className="text-base font-semibold">{iniciales}</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-semibold">
                  {perfil ? `${perfil.nombre} ${perfil.apellidos ?? ''}`.trim() : 'Cuenta'}
                </Text>
                <Text className="text-xs text-muted-foreground">{perfil?.email}</Text>
                <Text className="text-xs text-muted-foreground">
                  {perfil ? ROLES[perfil.rol].etiqueta : ''}
                </Text>
              </View>
            </View>
            <View className="gap-2">
              <Button
                variant="outline"
                className="w-full"
                onPress={() => {
                  setAbierta(false);
                  router.push(destinoCuenta());
                }}
              >
                <UserRound size={16} color={colores.primerPlano} />
                <Text>Mi cuenta</Text>
              </Button>
              {session && (
                <Button variant="ghost" className="w-full" onPress={() => void cerrarSesionLocal()}>
                  <LogOut size={16} color={colores.destructivo} />
                  <Text className="text-destructive">Cerrar sesión</Text>
                </Button>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
