import { Redirect, router } from 'expo-router';
import { ChevronLeft, Plus } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import {
  useAsignacionesProveedores,
  useComerciales,
  useCrearComercial,
  useProveedores,
} from '@/hooks/use-admin';
import { useAuth } from '@/hooks/use-auth';
import { useColoresIcono } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { PerfilUsuario, Proveedor } from '@/lib/types';

// Accesos a proveedores de un comercial: un chip por proveedor con
// asignar/habilitar/deshabilitar. Componente propio, así que puede llamar al
// hook de asignaciones (una instancia por comercial) sin romper las reglas de
// hooks. El toque en un chip no navega a la fila (stopPropagation).
function FilaComercial({
  comercial,
  proveedores,
}: {
  comercial: PerfilUsuario;
  proveedores: Proveedor[];
}) {
  const { asignaciones, cargando, error, recargar, asignar, habilitar } =
    useAsignacionesProveedores(comercial.id);
  const [errorAccion, setErrorAccion] = React.useState<string | null>(null);

  const ejecutar = async (accion: () => Promise<{ error: string | null }>) => {
    setErrorAccion(null);
    const { error } = await accion();
    setErrorAccion(error);
    if (!error) await recargar();
  };

  if (cargando) {
    return <ActivityIndicator size="small" color="hsl(24.6 95% 53.1%)" />;
  }
  if (error) {
    return <Text className="text-xs text-destructive">No se pudo cargar la asignación</Text>;
  }

  return (
    <View className="gap-1.5">
      <View className="flex-row flex-wrap gap-1.5">
        {proveedores.map((p) => {
          const asignacion = asignaciones.find((a) => a.proveedor_id === p.id);
          const habilitado = asignacion?.habilitado ?? false;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Proveedor ${p.nombre}: ${
                asignacion ? (habilitado ? 'habilitado' : 'deshabilitado') : 'sin asignar'
              }`}
              onPress={(e) => {
                e.stopPropagation();
                void ejecutar(
                  asignacion ? () => habilitar(p.id, !habilitado) : () => asignar(p.id)
                );
              }}
              className={cn(
                'rounded-full border px-2.5 py-1 active:opacity-80',
                asignacion
                  ? habilitado
                    ? 'border-transparent bg-primary/10'
                    : 'border-border bg-muted'
                  : 'border-border bg-background'
              )}
            >
              <Text
                numberOfLines={1}
                className={cn(
                  'max-w-28 text-xs font-medium',
                  asignacion
                    ? habilitado
                      ? 'text-primary'
                      : 'text-muted-foreground line-through'
                    : 'text-foreground'
                )}
              >
                {p.nombre}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {errorAccion && <Text className="text-xs text-muted-foreground">{errorAccion}</Text>}
    </View>
  );
}

export default function AdminComerciales() {
  const insets = useSafeAreaInsets();
  const { session, perfil } = useAuth();
  const colores = useColoresIcono();

  const { comerciales, clientesPorComercial, cargando, error, recargar } = useComerciales();
  const { crearComercial, cargando: creando } = useCrearComercial();
  const { proveedores } = useProveedores();

  const [modalAbierto, setModalAbierto] = React.useState(false);
  const [nombre, setNombre] = React.useState('');
  const [apellidos, setApellidos] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [mensaje, setMensaje] = React.useState<string | null>(null);

  if (!session) return <Redirect href="/acceso" />;
  if (perfil && perfil.rol !== 'admin') return <Redirect href="/pedidos" />;

  const crear = async () => {
    const nombreTrim = nombre.trim();
    const emailTrim = email.trim();
    if (!nombreTrim || !emailTrim || !password) {
      setMensaje('Nombre, email y contraseña son obligatorios.');
      return;
    }
    const { error } = await crearComercial({
      nombre: nombreTrim,
      apellidos: apellidos.trim() || null,
      email: emailTrim,
      password,
    });
    if (!error) {
      setMensaje(null);
      setNombre('');
      setApellidos('');
      setEmail('');
      setPassword('');
      setModalAbierto(false);
      await recargar();
      return;
    }
    setMensaje(error);
  };

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View style={{ paddingTop: insets.top + 8 }} className="gap-4 p-4">
          <View className="flex-row items-center gap-2">
            <Pressable onPress={() => router.back()} className="rounded-md p-1 active:bg-accent">
              <ChevronLeft size={24} color={colores.primerPlano} />
            </Pressable>
            <View className="flex-1 gap-0.5">
              <Text className="text-xl font-bold tracking-tight">Comerciales</Text>
              <Text className="text-xs text-muted-foreground">
                Equipo, clientes y accesos a proveedores
              </Text>
            </View>
            <Button
              size="sm"
              onPress={() => {
                setMensaje(null);
                setModalAbierto(true);
              }}
            >
              <Plus size={16} color={colores.primarioClaro} />
              <Text>Nuevo comercial</Text>
            </Button>
          </View>

          {/* Tabla de comerciales */}
          {cargando ? (
            <View className="items-center py-16">
              <ActivityIndicator color="hsl(24.6 95% 53.1%)" />
            </View>
          ) : error ? (
            <Text className="text-muted-foreground">{error}</Text>
          ) : comerciales.length === 0 ? (
            <Text className="text-muted-foreground">No hay comerciales todavía.</Text>
          ) : (
            <Card className="gap-0 rounded-[10px] p-0">
              {/* Cabecera de columnas */}
              <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
                <Text className="flex-1 text-xs font-semibold text-muted-foreground">
                  Comercial
                </Text>
                <Text className="w-32 text-xs font-semibold text-muted-foreground">
                  Proveedores
                </Text>
                <Text className="w-16 text-right text-xs font-semibold text-muted-foreground">
                  Clientes
                </Text>
              </View>

              {comerciales.map((c, i) => {
                const clientes = clientesPorComercial[c.id] ?? [];
                return (
                  <View key={c.id}>
                    <Pressable
                      onPress={() =>
                        router.push({ pathname: '/admin/comerciales/[id]', params: { id: c.id } })
                      }
                      className="active:bg-accent"
                    >
                      <View className="flex-row items-center gap-3 px-4 py-3">
                        <View className="flex-1 gap-0.5">
                          <Text numberOfLines={1} className="font-medium">
                            {c.nombre} {c.apellidos ?? ''}
                          </Text>
                          <Text numberOfLines={1} className="text-xs text-muted-foreground">
                            {c.email}
                          </Text>
                        </View>
                        <View className="w-32">
                          {proveedores.length === 0 ? (
                            <Text className="text-xs text-muted-foreground">
                              Sin proveedores
                            </Text>
                          ) : (
                            <FilaComercial comercial={c} proveedores={proveedores} />
                          )}
                        </View>
                        <View className="w-16 items-end">
                          <Badge variant="outline">
                            <Text>{clientes.length} clientes</Text>
                          </Badge>
                        </View>
                      </View>
                    </Pressable>
                    {i < comerciales.length - 1 && <Separator />}
                  </View>
                );
              })}
            </Card>
          )}
        </View>
      </ScrollView>

      {/* Modal: nuevo comercial */}
      <Modal
        transparent
        animationType="fade"
        visible={modalAbierto}
        onRequestClose={() => setModalAbierto(false)}
      >
        <View className="flex-1">
          <Pressable
            accessibilityLabel="Cerrar formulario"
            className="absolute inset-0 bg-black/50"
            onPress={() => setModalAbierto(false)}
          />
          <View className="flex-1 items-center justify-center p-4">
            <Card className="w-full max-w-md rounded-[10px]">
              <CardContent className="gap-2">
                <Text className="font-semibold">Nuevo comercial</Text>
                <Input
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder="Nombre (obligatorio)"
                  className="h-9 text-sm"
                />
                <Input
                  value={apellidos}
                  onChangeText={setApellidos}
                  placeholder="Apellidos"
                  className="h-9 text-sm"
                />
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email (obligatorio)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="h-9 text-sm"
                />
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Contraseña (obligatoria)"
                  secureTextEntry
                  className="h-9 text-sm"
                />
                <View className="flex-row justify-end gap-2 pt-1">
                  <Button size="sm" variant="outline" onPress={() => setModalAbierto(false)}>
                    <Text>Cancelar</Text>
                  </Button>
                  <Button size="sm" disabled={creando} onPress={() => void crear()}>
                    <Text>{creando ? 'Creando…' : 'Crear'}</Text>
                  </Button>
                </View>
                {mensaje && <Text className="text-xs text-muted-foreground">{mensaje}</Text>}
              </CardContent>
            </Card>
          </View>
        </View>
      </Modal>
    </>
  );
}
