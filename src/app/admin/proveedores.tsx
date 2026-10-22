import { Redirect, router } from 'expo-router';
import {
  Boxes,
  Check,
  ChevronLeft,
  Flame,
  Flower,
  Plus,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
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

// Icono asociado a cada proveedor: llama (pellets), flor (leña) o cajas por
// defecto. (Duplicada a propósito en admin/comerciales.tsx para no crear un
// módulo compartido mientras otros workers editan estos archivos.)
function iconoProveedor(icono: string | null | undefined): LucideIcon {
  if (icono === 'flame') return Flame;
  if (icono === 'flower') return Flower;
  return Boxes;
}

// Fila de un comercial dentro de un proveedor: checkbox de asignación.
// Marcado = fila existente y habilitada → desmarcar desasigna; sin fila →
// marcar asigna; fila deshabilitada → marcar la habilita. Cada fila es un
// componente propio, así que puede llamar al hook de asignaciones (una
// instancia por comercial) sin romper las reglas de hooks.
function FilaComercial({ comercial, proveedorId }: { comercial: PerfilUsuario; proveedorId: string }) {
  const colores = useColoresIcono();
  const { asignaciones, cargando, error: errorCarga, recargar, asignar, desasignar, habilitar } =
    useAsignacionesProveedores(comercial.id);
  const [errorAccion, setErrorAccion] = React.useState<string | null>(null);
  const [trabajando, setTrabajando] = React.useState(false);

  const asignacion = asignaciones.find((a) => a.proveedor_id === proveedorId);
  const marcado = asignacion?.habilitado === true;

  const alternar = async () => {
    if (cargando || trabajando) return;
    setTrabajando(true);
    setErrorAccion(null);
    let error: string | null;
    if (marcado) {
      // Desmarcar: quitar la asignación.
      error = (await desasignar(proveedorId)).error;
    } else if (asignacion) {
      // La fila existe pero está deshabilitada: marcar la vuelve a habilitar.
      error = (await habilitar(proveedorId, true)).error;
    } else {
      // Sin fila: marcar crea la asignación.
      error = (await asignar(proveedorId)).error;
    }
    setTrabajando(false);
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
        ) : errorCarga ? (
          <Text className="text-xs text-destructive">No se pudo cargar la asignación</Text>
        ) : (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marcado }}
            accessibilityLabel={`Asignar este proveedor a ${comercial.nombre}`}
            onPress={() => void alternar()}
            className={cn(
              'h-6 w-6 flex-row items-center justify-center rounded-md border',
              marcado ? 'border-transparent bg-primary' : 'border-border bg-background'
            )}
          >
            {trabajando ? (
              <ActivityIndicator
                size="small"
                color={marcado ? colores.primarioClaro : colores.primario}
              />
            ) : marcado ? (
              <Check size={16} color={colores.primarioClaro} />
            ) : null}
          </Pressable>
        )}
      </View>
      {errorAccion && <Text className="text-xs text-destructive">{errorAccion}</Text>}
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

  // Formulario de creación, ahora en un modal como el de "Nuevo comercial".
  const [modalAbierto, setModalAbierto] = React.useState(false);
  const [nombre, setNombre] = React.useState('');
  const [nif, setNif] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [telefono, setTelefono] = React.useState('');
  const [creando, setCreando] = React.useState(false);
  const [mensajeCrear, setMensajeCrear] = React.useState<string | null>(null);

  // Mensajes de la edición inline (el modal está cerrado en ese caso).
  const [mensajeLista, setMensajeLista] = React.useState<string | null>(null);

  const [proveedorEditando, setProveedorEditando] = React.useState<string | null>(null);
  const [editNombre, setEditNombre] = React.useState('');
  const [editNif, setEditNif] = React.useState('');
  const [editEmail, setEditEmail] = React.useState('');
  const [editTelefono, setEditTelefono] = React.useState('');

  if (!session) return <Redirect href="/acceso" />;
  if (perfil && perfil.rol !== 'admin') return <Redirect href="/pedidos" />;

  const abrirModal = () => {
    setMensajeCrear(null);
    setModalAbierto(true);
  };

  const crear = async () => {
    const nombreTrim = nombre.trim();
    if (!nombreTrim) {
      setMensajeCrear('El nombre es obligatorio.');
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
    setMensajeCrear(error);
    if (!error) {
      setNombre('');
      setNif('');
      setEmail('');
      setTelefono('');
      setModalAbierto(false);
      await recargar();
    }
  };

  const abrirEdicion = (p: Proveedor) => {
    setProveedorEditando((prev) => (prev === p.id ? null : p.id));
    setEditNombre(p.nombre);
    setEditNif(p.nif ?? '');
    setEditEmail(p.email ?? '');
    setEditTelefono(p.telefono ?? '');
    setMensajeLista(null);
  };

  const guardarEdicion = async (id: string) => {
    const nombreTrim = editNombre.trim();
    if (!nombreTrim) {
      setMensajeLista('El nombre no puede quedar vacío.');
      return;
    }
    // Los campos opcionales se envían tal cual (recortados): una cadena vacía
    // significa "limpiar el campo" en el servidor (actualizar_proveedor usa
    // NULLIF(btrim(...))), mientras que null significaría "sin cambios".
    const { error } = await actualizarProveedor(id, {
      nombre: nombreTrim,
      nif: editNif.trim(),
      email: editEmail.trim(),
      telefono: editTelefono.trim(),
    });
    setMensajeLista(error ?? 'Proveedor actualizado.');
    if (!error) {
      setProveedorEditando(null);
      await recargar();
    }
  };

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View style={{ paddingTop: insets.top + 8 }} className="gap-4 p-4">
          <View className="flex-row items-center gap-2">
            <Pressable onPress={() => router.back()} className="rounded-md p-1 active:bg-accent">
              <ChevronLeft size={24} color={colores.primerPlano} />
            </Pressable>
            <Text className="flex-1 text-xl font-bold tracking-tight">Proveedores</Text>
            <Button size="sm" onPress={abrirModal}>
              <Plus size={16} color={colores.primarioClaro} />
              <Text>Nuevo proveedor</Text>
            </Button>
          </View>

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
              {mensajeLista && <Text className="text-sm text-muted-foreground">{mensajeLista}</Text>}
              {proveedores.map((p) => {
                const Icono = iconoProveedor(p.icono);
                return (
                <Card key={p.id} className="rounded-[10px] p-4">
                  <CardContent className="gap-2">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1 gap-1">
                        <View className="flex-row items-center gap-2">
                          <Icono size={18} color={colores.primario} />
                          <Text className="font-medium">{p.nombre}</Text>
                        </View>
                        <Text className="text-xs text-muted-foreground">
                          {[p.nif, p.email, p.telefono].filter(Boolean).join(' · ') ||
                            'Sin datos de contacto'}
                        </Text>
                      </View>
                      {/* Solo lectura: la activación ya no se gestiona aquí. */}
                      <Badge variant={p.activo ? 'default' : 'outline'}>
                        <Text>{p.activo ? 'Activo' : 'Inactivo'}</Text>
                      </Badge>
                    </View>

                    <View className="flex-row flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        // El catálogo vive en la ruta raíz ('/'): se filtra por
                        // proveedor con el query param que lee catalogo-screen.
                        onPress={() =>
                          router.push({ pathname: '/', params: { proveedor: p.id } })
                        }
                      >
                        <Boxes size={14} color={colores.tenue} />
                        <Text className="text-xs">Ver catálogo</Text>
                      </Button>
                      <Button size="sm" variant="outline" onPress={() => abrirEdicion(p)}>
                        <Text className="text-xs">
                          {proveedorEditando === p.id ? 'Cerrar edición' : 'Editar'}
                        </Text>
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

                    {/* Comerciales con acceso a este proveedor (checkboxes) */}
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
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal: nuevo proveedor (mismo patrón que el de "Nuevo comercial"). */}
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
                <View className="flex-row justify-end gap-2 pt-1">
                  <Button size="sm" variant="outline" onPress={() => setModalAbierto(false)}>
                    <Text>Cancelar</Text>
                  </Button>
                  <Button size="sm" disabled={creando} onPress={() => void crear()}>
                    <Text>{creando ? 'Creando…' : 'Crear'}</Text>
                  </Button>
                </View>
                {mensajeCrear && (
                  <Text className="text-xs text-muted-foreground">{mensajeCrear}</Text>
                )}
              </CardContent>
            </Card>
          </View>
        </View>
      </Modal>
    </>
  );
}
