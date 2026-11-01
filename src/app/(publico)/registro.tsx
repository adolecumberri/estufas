import { router } from 'expo-router';
import { Flame } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ScreenScroll } from '@/shared/componentes/screen';
import { FormField } from '@/shared/ui';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Text } from '@/shared/ui/text';
import { APP, TIPOS_CLIENTE, type TipoCliente } from '@/shared/constantes';
import { useAuth } from '@/features/auth/use-auth';
import { useColoresIcono } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

export default function Registro() {
  const { registrar } = useAuth();
  const colores = useColoresIcono();

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
    <ScreenScroll contentClassName="flex-1 justify-center">
      <Card className="w-full max-w-sm self-center">
        <CardHeader className="gap-4">
          <View className="flex-row items-center gap-2.5">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Flame size={18} color={colores.primario} />
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
          <View className="flex-row gap-1 rounded-lg border border-border bg-muted p-1">
            {(Object.keys(TIPOS_CLIENTE) as TipoCliente[]).map((t) => (
              <Pressable
                key={t}
                accessibilityRole="button"
                accessibilityState={{ selected: tipo === t }}
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

          <FormField etiqueta="Nombre">
            <Input
              className="h-11 rounded-lg sm:h-11"
              value={nombre}
              onChangeText={setNombre}
              placeholder="Tu nombre"
            />
          </FormField>
          <FormField etiqueta="Apellidos">
            <Input
              className="h-11 rounded-lg sm:h-11"
              value={apellidos}
              onChangeText={setApellidos}
              placeholder="Tus apellidos"
            />
          </FormField>
          {tipo === 'empresa' && (
            <>
              <FormField etiqueta="Razón social">
                <Input
                  className="h-11 rounded-lg sm:h-11"
                  value={razonSocial}
                  onChangeText={setRazonSocial}
                  placeholder="Nombre de la empresa"
                />
              </FormField>
              <FormField etiqueta="NIF/CIF">
                <Input
                  className="h-11 rounded-lg sm:h-11"
                  value={nifCif}
                  onChangeText={setNifCif}
                  placeholder="B12345678"
                  autoCapitalize="characters"
                />
              </FormField>
            </>
          )}
          <FormField etiqueta="Email">
            <Input
              className="h-11 rounded-lg sm:h-11"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
            />
          </FormField>
          <FormField etiqueta="Teléfono (opcional)">
            <Input
              className="h-11 rounded-lg sm:h-11"
              keyboardType="phone-pad"
              value={telefono}
              onChangeText={setTelefono}
              placeholder="600 000 000"
            />
          </FormField>
          <FormField etiqueta="Contraseña">
            <Input
              className="h-11 rounded-lg sm:h-11"
              autoComplete="new-password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
            />
          </FormField>
          {error && <Text className="text-sm text-destructive">{error}</Text>}
          <Button
            className="h-11 w-full sm:h-11"
            disabled={enviando}
            onPress={() => void crearCuenta()}
          >
            {enviando ? <ActivityIndicator color={colores.primarioClaro} /> : <Text>Crear cuenta</Text>}
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
    </ScreenScroll>
  );
}
