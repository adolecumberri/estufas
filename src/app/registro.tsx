import { router } from 'expo-router';
import { Flame } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { APP, TIPOS_CLIENTE, type TipoCliente } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export default function Registro() {
  const insets = useSafeAreaInsets();
  const { registrar } = useAuth();

  const [tipo, setTipo] = React.useState<TipoCliente>('particular');
  const [nombre, setNombre] = React.useState('');
  const [apellidos, setApellidos] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [telefono, setTelefono] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [razonSocial, setRazonSocial] = React.useState('');
  const [nifCif, setNifCif] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);

  const crearCuenta = async () => {
    setError(null);
    if (!nombre.trim() || !email.trim() || password.length < 6) {
      setError('Nombre, email válido y contraseña (mín. 6 caracteres) son obligatorios.');
      return;
    }
    if (tipo === 'empresa' && (!razonSocial.trim() || !nifCif.trim())) {
      setError('Las empresas necesitan razón social y NIF/CIF.');
      return;
    }
    setEnviando(true);
    const err = await registrar(email, password, {
      tipo_cliente: tipo,
      nombre: nombre.trim(),
      apellidos: apellidos.trim() || undefined,
      telefono: telefono.trim() || undefined,
      razon_social: tipo === 'empresa' ? razonSocial.trim() : undefined,
      nif_cif: tipo === 'empresa' ? nifCif.trim() : undefined,
    });
    setEnviando(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace('/pedidos');
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <Card className="w-full max-w-sm self-center">
          <CardHeader className="gap-4">
            <View className="flex-row items-center gap-2.5">
              <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Flame size={18} className="text-primary" />
              </View>
              <Text className="text-xl font-bold">{APP.nombre}</Text>
            </View>
            <View className="gap-1.5">
              <CardTitle className="text-2xl font-bold">Crear cuenta</CardTitle>
              <Text className="text-sm text-muted-foreground">
                Regístrate como cliente para solicitar productos con tus condiciones.
              </Text>
            </View>
          </CardHeader>
          <CardContent className="gap-4">
            <View className="flex-row gap-1 rounded-[10px] border border-border bg-muted p-1">
              {(Object.keys(TIPOS_CLIENTE) as TipoCliente[]).map((t) => (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  onPress={() => setTipo(t)}
                  className={cn(
                    'flex-1 items-center justify-center rounded-[8px] px-3 py-2',
                    tipo === t && 'bg-primary'
                  )}
                >
                  <Text
                    className={cn(
                      'text-center text-sm font-medium',
                      tipo === t ? 'text-primary-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {TIPOS_CLIENTE[t].etiqueta}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="gap-1.5">
              <Label nativeID="nombre">Nombre</Label>
              <Input
                id="nombre"
                className="h-11 rounded-[10px] sm:h-11"
                value={nombre}
                onChangeText={setNombre}
                placeholder="Tu nombre"
              />
            </View>
            <View className="gap-1.5">
              <Label nativeID="apellidos">Apellidos</Label>
              <Input
                id="apellidos"
                className="h-11 rounded-[10px] sm:h-11"
                value={apellidos}
                onChangeText={setApellidos}
                placeholder="Tus apellidos"
              />
            </View>
            {tipo === 'empresa' && (
              <>
                <View className="gap-1.5">
                  <Label nativeID="razon">Razón social</Label>
                  <Input
                    id="razon"
                    className="h-11 rounded-[10px] sm:h-11"
                    value={razonSocial}
                    onChangeText={setRazonSocial}
                    placeholder="Nombre de la empresa"
                  />
                </View>
                <View className="gap-1.5">
                  <Label nativeID="nif">NIF/CIF</Label>
                  <Input
                    id="nif"
                    className="h-11 rounded-[10px] sm:h-11"
                    value={nifCif}
                    onChangeText={setNifCif}
                    placeholder="B12345678"
                    autoCapitalize="characters"
                  />
                </View>
              </>
            )}
            <View className="gap-1.5">
              <Label nativeID="email">Email</Label>
              <Input
                id="email"
                className="h-11 rounded-[10px] sm:h-11"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
              />
            </View>
            <View className="gap-1.5">
              <Label nativeID="telefono">Teléfono (opcional)</Label>
              <Input
                id="telefono"
                className="h-11 rounded-[10px] sm:h-11"
                keyboardType="phone-pad"
                value={telefono}
                onChangeText={setTelefono}
                placeholder="600 000 000"
              />
            </View>
            <View className="gap-1.5">
              <Label nativeID="password">Contraseña</Label>
              <Input
                id="password"
                className="h-11 rounded-[10px] sm:h-11"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="Mínimo 6 caracteres"
              />
            </View>
            {error && <Text className="text-sm text-destructive">{error}</Text>}
            <Button
              className="h-11 w-full sm:h-11"
              disabled={enviando}
              onPress={() => void crearCuenta()}
            >
              {enviando ? <ActivityIndicator color="hsl(0 0% 98%)" /> : <Text>Crear cuenta</Text>}
            </Button>
            <Pressable
              accessibilityRole="link"
              className="self-center py-1"
              onPress={() => router.push('/acceso')}
            >
              <Text className="text-sm font-medium text-primary">
                ¿Ya tienes cuenta? Inicia sesión
              </Text>
            </Pressable>
          </CardContent>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
