import { Redirect, router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAsignacionesProveedores, useProveedores, useUsuarios } from '@/hooks/use-admin';
import { useAuth } from '@/hooks/use-auth';
import { useColoresIcono } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { PerfilUsuario, Proveedor } from '@/lib/types';

// Fila de un comercial dentro de un proveedor: su asignación, el toggle
// habilitado/deshabilitado y las acciones asignar/desasignar. Cada fila es un
// componente propio, así que puede llamar al hook de asignaciones (una
// instancia por comercial) sin romper las reglas de hooks.
function FilaComercial({ comercial, proveedorId }: { comercial: PerfilUsuario; proveedorId: string }) {
  const { asignaciones, cargando, recargar, asignar, desasignar, habilitar } =
    useAsignacionesProveedores(comercial.id);
  const [errorAccion, setErrorAccion] = React.useState<string | null>(null);

  const asignacion = asignaciones.find((a) => a.proveedor_id === proveedorId);

  const ejecutar = async (accion: () => Promise<{ error: string | null }>) => {
    setErrorAccion(null);
    const { error } = await accion();
    setErrorAccion(error);
    if (!error) await recargar();
  };

  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text numberOfLines={1} className="text-xs">
            {comercial.nombre} {comercial.apellidos ?? ''}
          </Text>
          {asignacion && (
            <Badge variant="outline" className="mt-1 self-start">
              <Text className="text-[10px]">
                Asignado{asignacion.habilitado ? '' : ' · deshabilitado'}
              </Text>
            </Badge>
          )}
        </View>
        {cargando ? (
          <ActivityIndicator size="small" color="hsl(24.6 95% 53.1%)" />
        ) : asignacion ? (
          <View className="flex-row items-center gap-2">
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: asignacion.habilitado }}
              accessibilityLabel={`Proveedor habilitado para ${comercial.nombre}`}
              onPress={() => void ejecutar(() => habilitar(proveedorId, !asignacion.habilitado))}
              className={cn(
                'h-5 w-9 flex-row items-center rounded-full px-0.5',
                asignacion.habilitado ? 'justify-end bg-primary' : 'justify-start bg-muted'
              )}
            >
              <View className="h-4 w-4 rounded-full bg-white" />
            </Pressable>
            <Button
              size="sm"
              variant="outline"
              onPress={() => void ejecutar(() => desasignar(proveedorId))}
            >
              <Text className="text-xs">Desasignar</Text>
            </Button>
          </View>
        ) : (
          <Button size="sm" onPress={() => void ejecutar(() => asignar(proveedorId))}>
            <Text className="text-xs">Asignar</Text>
          </Button>
        )}
      </View>
      {errorAccion && <Text className="text-xs text-muted-foreground">{errorAccion}</Text>}
    </View>
  );
}

export default function AdminProveedores() {
  const insets = useSafeAreaInsets();
  const { session, perfil } = useAuth();
  const colores = useColoresIcono();

  const { proveedores, cargando, error, recargar, crearProveedor, actualizarProveedor } =
    useProveedores();
  const { usuarios } = useUsuarios();
  const comerciales = usuarios.filter((u) => u.rol === 'comercial');

  const [nombre, setNombre] = React.useState('');
  const [nif, setNif] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [telefono, setTelefono] = React.useState('');
  const [creando, setCreando] = React.useState(false);
  const [mensaje, setMensaje] = React.useState<string | null>(null);

  const [proveedorEditando, setProveedorEditando] = React.useState<string | null>(null);
  const [editNombre, setEditNombre] = React.useState('');
  const [editNif, setEditNif] = React.useState('');
  const [editEmail, setEditEmail] = React.useState('');
  const [editTelefono, setEditTelefono] = React.useState('');

  if (!session) return <Redirect href="/acceso" />;
  if (perfil && perfil.rol !== 'admin') return <Redirect href="/pedidos" />;

  const crear = async () => {
    const nombreTrim = nombre.trim();
    if (!nombreTrim) {
      setMensaje('El nombre es obligatorio.');
      return;
    }
    setCreando(true);
    const { error } = await crearProveedor({
      nombre: nombreTrim,
      nif: nif.trim() || null,
      email: email.trim() || null,
      telefono: telefono.trim() || null,
    });
    setCreando(false);
    setMensaje(error ?? 'Proveedor creado.');
    if (!error) {
      setNombre('');
      setNif('');
      setEmail('');
      setTelefono('');
      await recargar();
    }
  };

  const abrirEdicion = (p: Proveedor) => {
    setProveedorEditando((prev) => (prev === p.id ? null : p.id));
    setEditNombre(p.nombre);
    setEditNif(p.nif ?? '');
    setEditEmail(p.email ?? '');
    setEditTelefono(p.telefono ?? '');
  };

  const guardarEdicion = async (id: string) => {
    const nombreTrim = editNombre.trim();
    if (!nombreTrim) {
      setMensaje('El nombre no puede quedar vacío.');
      return;
    }
    const { error } = await actualizarProveedor(id, {
      nombre: nombreTrim,
      nif: editNif.trim() || null,
      email: editEmail.trim() || null,
      telefono: editTelefono.trim() || null,
    });
    setMensaje(error ?? 'Proveedor actualizado.');
    if (!error) {
      setProveedorEditando(null);
      await recargar();
    }
  };

  const alternarActivo = async (p: Proveedor) => {
    const { error } = await actualizarProveedor(p.id, { activo: !p.activo });
    setMensaje(error ?? (p.activo ? 'Proveedor desactivado.' : 'Proveedor activado.'));
    if (!error) await recargar();
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ paddingTop: insets.top + 8 }} className="gap-4 p-4">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.back()} className="rounded-md p-1 active:bg-accent">
            <ChevronLeft size={24} color={colores.primerPlano} />
          </Pressable>
          <Text className="text-xl font-bold tracking-tight">Proveedores</Text>
        </View>

        {/* Formulario: nuevo proveedor */}
        <Card className="rounded-[10px]">
          <CardContent className="gap-2">
            <Text className="font-semibold">Nuevo proveedor</Text>
            <Input
              value={nombre}
              onChangeText={setNombre}
              placeholder="Nombre (obligatorio)"
              className="h-9 text-sm"
            />
            <Input value={nif} onChangeText={setNif} placeholder="NIF" className="h-9 text-sm" />
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              className="h-9 text-sm"
            />
            <Input
              value={telefono}
              onChangeText={setTelefono}
              placeholder="Teléfono"
              keyboardType="phone-pad"
              className="h-9 text-sm"
            />
            <Button size="sm" disabled={creando} onPress={() => void crear()}>
              <Text>{creando ? 'Creando…' : 'Crear'}</Text>
            </Button>
            {mensaje && <Text className="text-xs text-muted-foreground">{mensaje}</Text>}
          </CardContent>
        </Card>

        {/* Lista de proveedores */}
        {cargando ? (
          <View className="items-center py-16">
            <ActivityIndicator color="hsl(24.6 95% 53.1%)" />
          </View>
        ) : error ? (
          <Text className="text-muted-foreground">{error}</Text>
        ) : proveedores.length === 0 ? (
          <Text className="text-muted-foreground">No hay proveedores todavía.</Text>
        ) : (
          <View className="gap-3">
            {proveedores.map((p) => (
              <Card key={p.id} className="rounded-[10px] p-4">
                <CardContent className="gap-2">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1 gap-1">
                      <Text className="font-medium">{p.nombre}</Text>
                      <Text className="text-xs text-muted-foreground">
                        {[p.nif, p.email, p.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                      </Text>
                    </View>
                    <Badge variant={p.activo ? 'default' : 'outline'}>
                      <Text>{p.activo ? 'Activo' : 'Inactivo'}</Text>
                    </Badge>
                  </View>

                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => abrirEdicion(p)}
                    >
                      <Text className="text-xs">
                        {proveedorEditando === p.id ? 'Cerrar edición' : 'Editar'}
                      </Text>
                    </Button>
                    <Button
                      size="sm"
                      variant={p.activo ? 'outline' : 'secondary'}
                      onPress={() => void alternarActivo(p)}
                    >
                      <Text className="text-xs">{p.activo ? 'Desactivar' : 'Activar'}</Text>
                    </Button>
                  </View>

                  {proveedorEditando === p.id && (
                    <View className="gap-2">
                      <Input
                        value={editNombre}
                        onChangeText={setEditNombre}
                        placeholder="Nombre"
                        className="h-9 text-sm"
                      />
                      <Input
                        value={editNif}
                        onChangeText={setEditNif}
                        placeholder="NIF"
                        className="h-9 text-sm"
                      />
                      <Input
                        value={editEmail}
                        onChangeText={setEditEmail}
                        placeholder="Email"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        className="h-9 text-sm"
                      />
                      <Input
                        value={editTelefono}
                        onChangeText={setEditTelefono}
                        placeholder="Teléfono"
                        keyboardType="phone-pad"
                        className="h-9 text-sm"
                      />
                      <Button size="sm" variant="secondary" onPress={() => void guardarEdicion(p.id)}>
                        <Text>Guardar</Text>
                      </Button>
                    </View>
                  )}

                  {/* Comerciales asignados a este proveedor */}
                  <View className="gap-2 border-t border-border pt-3">
                    <Text className="text-sm font-semibold">Comerciales</Text>
                    {comerciales.length === 0 ? (
                      <Text className="text-xs text-muted-foreground">
                        No hay comerciales registrados.
                      </Text>
                    ) : (
                      comerciales.map((c) => (
                        <FilaComercial key={c.id} comercial={c} proveedorId={p.id} />
                      ))
                    )}
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
