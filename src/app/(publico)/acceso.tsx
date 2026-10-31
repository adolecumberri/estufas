import { router } from 'expo-router';
import { Flame } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Text } from '@/shared/ui/text';
import { APP } from '@/shared/constantes';
import { useAuth } from '@/features/auth/use-auth';
import { useColoresIcono } from '@/shared/lib/theme';

export default function Acceso() {
  const insets = useSafeAreaInsets();
  const { iniciarSesion, perfil } = useAuth();
  const colores = useColoresIcono();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);

  const destinoPorRol = (rol?: string | null) => {
    if (rol === 'admin') return '/admin';
    if (rol === 'comercial') return '/cartera';
    return '/pedidos';
  };

  const entrar = async () => {
    if (!email.trim() || !password) {
      setError('Introduce email y contraseña.');
      return;
    }
    setEnviando(true);
    setError(null);
    const err = await iniciarSesion(email, password);
    setEnviando(false);
    if (err) {
      setError(err);
      return;
    }
    // El perfil se refresca dentro de iniciarSesion; navegamos según el rol actual.
    router.replace(destinoPorRol(perfil?.rol));
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        className="flex-1 justify-center px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <Card className="w-full max-w-sm self-center">
          <CardHeader className="gap-4">
            <View className="flex-row items-center gap-2.5">
              <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Flame size={18} color={colores.primario} />
              </View>
              <Text className="text-xl font-bold">{APP.nombre}</Text>
            </View>
            <View className="gap-1.5">
              <CardTitle className="text-2xl font-bold">Inicia sesión</CardTitle>
              <Text className="text-sm text-muted-foreground">
                Accede a tu área de {APP.nombre} para consultar tus condiciones y pedidos.
              </Text>
            </View>
          </CardHeader>
          <CardContent className="gap-4">
            <View className="gap-1.5">
              <Label nativeID="email">Email</Label>
              <Input
                id="email"
                className="h-11 rounded-lg sm:h-11"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
              />
            </View>
            <View className="gap-1.5">
              <Label nativeID="password">Contraseña</Label>
              <Input
                id="password"
                className="h-11 rounded-lg sm:h-11"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                onSubmitEditing={() => void entrar()}
              />
            </View>
            {error && <Text className="text-sm text-destructive">{error}</Text>}
            <Button
              className="h-11 w-full sm:h-11"
              disabled={enviando}
              onPress={() => void entrar()}
            >
              {enviando ? <ActivityIndicator color="hsl(0 0% 98%)" /> : <Text>Entrar</Text>}
            </Button>
            <Pressable
              accessibilityRole="link"
              className="self-center py-1"
              onPress={() => router.push('/registro')}
            >
              <Text className="text-sm font-medium text-primary">
                ¿No tienes cuenta? Regístrate
              </Text>
            </Pressable>
            <Button variant="ghost" className="w-full" onPress={() => router.replace('/')}>
              <Text className="text-sm text-muted-foreground">Volver al catálogo</Text>
            </Button>
            {__DEV__ && (
              <Pressable
                accessibilityRole="link"
                className="self-center py-1"
                // '/dev/acceso' aún no está en los tipos generados de rutas
                // (.expo/types/router.d.ts): se regeneran al arrancar el dev
                // server. El `as never` mantiene el typecheck verde hasta entonces.
                onPress={() => router.push('/dev/acceso' as never)}
              >
                <Text className="text-xs text-muted-foreground underline">
                  Acceso rápido (dev)
                </Text>
              </Pressable>
            )}
          </CardContent>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}
