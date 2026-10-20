import { router } from 'expo-router';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { APP } from '@/constants';
import { useAuth } from '@/hooks/use-auth';

export default function Acceso() {
  const insets = useSafeAreaInsets();
  const { iniciarSesion, perfil } = useAuth();

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
        <Card className="max-w-sm self-center">
          <CardHeader>
            <CardTitle className="text-xl">Iniciar sesión</CardTitle>
            <Text className="text-sm text-muted-foreground">
              Accede a tu área de {APP.nombre} para consultar tus condiciones y pedidos.
            </Text>
          </CardHeader>
          <CardContent className="gap-4">
            <View className="gap-1.5">
              <Label nativeID="email">Email</Label>
              <Input
                id="email"
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
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                onSubmitEditing={() => void entrar()}
              />
            </View>
            {error && <Text className="text-sm text-destructive">{error}</Text>}
            <Button disabled={enviando} onPress={() => void entrar()}>
              <Text>{enviando ? 'Entrando…' : 'Entrar'}</Text>
            </Button>
            <Button variant="link" onPress={() => router.push('/registro')}>
              <Text className="text-sm">¿No tienes cuenta? Regístrate</Text>
            </Button>
            <Button variant="ghost" onPress={() => router.replace('/')}>
              <Text className="text-sm text-muted-foreground">Volver al catálogo</Text>
            </Button>
          </CardContent>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}
