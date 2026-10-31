import { router } from 'expo-router';
import {
  Boxes,
  Factory,
  Flame,
  Flower,
  Plus,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { EmptyState, ErrorView, LoadingView } from '@/components/comunes/estados';
import { ScreenScroll } from '@/components/comunes/screen';
import { ScreenHeader } from '@/components/comunes/screen-header';
import { FormField, FormModal } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useProveedores } from '@/hooks/use-admin';
import { temaProveedor } from '@/lib/colores-proveedor';
import { useColoresIcono } from '@/lib/theme';
import type { Proveedor } from '@/lib/types';

// Icono asociado a cada proveedor: llama (pellets), flor (leña) o cajas por
// defecto. (Duplicada a propósito en admin/comerciales.tsx para no crear un
// módulo compartido mientras otros workers editan estos archivos.)
function iconoProveedor(icono: string | null | undefined): LucideIcon {
  if (icono === 'flame') return Flame;
  if (icono === 'flower') return Flower;
  return Boxes;
}

export default function AdminProveedores() {
  const colores = useColoresIcono();

  const { proveedores, cargando, error, recargar, crearProveedor, actualizarProveedor } =
    useProveedores();

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
      <ScreenScroll>
        <ScreenHeader
          titulo="Proveedores"
          respaldo="/admin"
          accion={
            <Button size="sm" onPress={abrirModal}>
              <Plus size={16} color={colores.primarioClaro} />
              <Text>Nuevo proveedor</Text>
            </Button>
          }
        />

        {/* Lista de proveedores */}
        {cargando ? (
          <LoadingView />
        ) : error ? (
          <ErrorView mensaje={error} />
        ) : proveedores.length === 0 ? (
          <EmptyState titulo="Sin proveedores registrados" icono={Factory} />
        ) : (
          <View className="gap-3">
            {mensajeLista && <Text className="text-sm text-muted-foreground">{mensajeLista}</Text>}
            {proveedores.map((p) => {
              const Icono = iconoProveedor(p.icono);
              const tema = temaProveedor(p.color);
              return (
                <Card key={p.id} className="rounded-lg p-4">
                  <CardContent className="gap-2">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1 gap-1">
                        <View className="flex-row items-center gap-2">
                          <Icono size={18} color={tema.base} />
                          <Text className="font-medium">{p.nombre}</Text>
                          <View
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: tema.base }}
                          />
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
                        style={{ borderColor: tema.borde }}
                        // Ruta dedicada del catálogo del proveedor; si aún no
                        // está en los tipos generados, el cast mantiene el
                        // typecheck verde (se regeneran al arrancar dev).
                        onPress={() =>
                          router.push({
                            pathname: '/catalogo/proveedor/[id]',
                            params: { id: p.id },
                          } as never)
                        }
                      >
                        <Boxes size={14} color={colores.tenue} />
                        <Text className="text-xs" style={{ color: tema.texto }}>
                          Ver catálogo
                        </Text>
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
                  </CardContent>
                </Card>
              );
            })}
          </View>
        )}
      </ScreenScroll>

      {/* Modal: nuevo proveedor */}
      <FormModal
        visible={modalAbierto}
        titulo="Nuevo proveedor"
        onCerrar={() => setModalAbierto(false)}
        acciones={
          <>
            <Button size="sm" variant="outline" onPress={() => setModalAbierto(false)}>
              <Text>Cancelar</Text>
            </Button>
            <Button size="sm" disabled={creando} onPress={() => void crear()}>
              <Text>{creando ? 'Creando…' : 'Crear'}</Text>
            </Button>
          </>
        }
      >
        <FormField etiqueta="Nombre" requerido>
          <Input
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre"
            className="h-9 text-sm"
          />
        </FormField>
        <FormField etiqueta="NIF">
          <Input value={nif} onChangeText={setNif} placeholder="NIF" className="h-9 text-sm" />
        </FormField>
        <FormField etiqueta="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            className="h-9 text-sm"
          />
        </FormField>
        <FormField etiqueta="Teléfono">
          <Input
            value={telefono}
            onChangeText={setTelefono}
            placeholder="Teléfono"
            keyboardType="phone-pad"
            className="h-9 text-sm"
          />
        </FormField>
        {mensajeCrear && <Text className="text-xs text-muted-foreground">{mensajeCrear}</Text>}
      </FormModal>
    </>
  );
}
