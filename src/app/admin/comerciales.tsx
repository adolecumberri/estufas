import { Redirect, router } from 'expo-router';
import { Check, ChevronLeft, Plus } from 'lucide-react-native';
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

// Accesos a proveedores de un comercial: un checkbox por proveedor (único
// booleano: asignado). Componente propio, así que puede llamar al hook de
// asignaciones (una instancia por comercial) sin romper las reglas de hooks.
// El toque en un checkbox no navega a la fila (stopPropagation).
function FilaComercial({
  comercial,
  proveedores,
}: {
  comercial: PerfilUsuario;
  proveedores: Proveedor[];
}) {
  const { asignaciones, cargando, error, recargar, asignar, desasignar, habilitar } =
    useAsignacionesProveedores(comercial.id);
  const [errorAccion, setErrorAccion] = React.useState<string | null>(null);
  const colores = useColoresIcono();

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
    <View className="gap-0.5">
      {proveedores.map((p) => {
        // La fila se busca independientemente de `habilitado`. Marcado =
        // asignación activa: una fila deshabilitada se muestra sin marcar y al
        // marcarla se rehabilita en lugar de crear un duplicado.
        const fila = asignaciones.find((a) => a.proveedor_id === p.id);
        const marcado = fila?.habilitado === true;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marcado }}
            accessibilityLabel={`Proveedor ${p.nombre} ${marcado ? 'asignado' : 'sin asignar'}`}
            onPress={(e) => {
              e.stopPropagation();
              void ejecutar(
                !fila
                  ? () => asignar(p.id)
                  : fila.habilitado
                    ? () => desasignar(p.id)
                    : () => habilitar(p.id, true)
              );
            }}
            className="flex-row items-center gap-2 py-0.5 active:opacity-80"
          >
            <View
              className={cn(
                'h-5 w-5 items-center justify-center rounded border',
                marcado ? 'border-primary bg-primary/10' : 'border-border bg-background'
              )}
            >
              {marcado && <Check size={14} strokeWidth={3} color={colores.primario} />}
            </View>
            <Text
              numberOfLines={1}
              className={cn(
                'flex-1 text-xs font-medium',
                marcado ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {p.nombre}
            </Text>
          </Pressable>
        );
      })}
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
                <Text className="w-36 text-xs font-semibold text-muted-foreground">
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
                        <View className="w-36">
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
