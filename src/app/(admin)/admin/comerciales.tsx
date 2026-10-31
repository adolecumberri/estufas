import { router } from 'expo-router';
import {
  Boxes,
  Check,
  Flame,
  Flower,
  Plus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { EmptyState, ErrorView, LoadingView } from '@/shared/componentes/estados';
import { ScreenScroll } from '@/shared/componentes/screen';
import { ScreenHeader } from '@/shared/componentes/screen-header';
import { FormField, FormModal } from '@/shared/ui';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Separator } from '@/shared/ui/separator';
import { Text } from '@/shared/ui/text';
import {
  useAsignacionesProveedores,
  useComerciales,
  useCrearComercial,
  useProveedores,
} from '@/features/admin/hooks/use-admin';
import { temaProveedor } from '@/shared/lib/colores-proveedor';
import { useColoresIcono } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';
import type { PerfilUsuario, Proveedor } from '@/shared/lib/types';

// Icono asociado a cada proveedor: llama (pellets), flor (leña) o cajas por
// defecto. (Duplicada a propósito en admin/proveedores.tsx para no crear un
// módulo compartido mientras otros workers editan estos archivos.)
function iconoProveedor(icono: string | null | undefined): LucideIcon {
  if (icono === 'flame') return Flame;
  if (icono === 'flower') return Flower;
  return Boxes;
}

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
    return <ActivityIndicator size="small" color={colores.primario} />;
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
        const Icono = iconoProveedor(p.icono);
        const tema = temaProveedor(p.color);
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
                marcado ? 'border-transparent' : 'border-border bg-background'
              )}
              style={marcado ? { backgroundColor: tema.base } : undefined}
            >
              {marcado && <Check size={14} strokeWidth={3} color={colores.primarioClaro} />}
            </View>
            <Icono size={14} color={tema.base} />
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
      <ScreenScroll>
        <ScreenHeader
          titulo="Comerciales"
          subtitulo="Equipo, clientes y accesos a proveedores"
          respaldo="/admin"
          accion={
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
          }
        />

        {/* Tabla de comerciales */}
        {cargando ? (
          <LoadingView />
        ) : error ? (
          <ErrorView mensaje={error} />
        ) : comerciales.length === 0 ? (
          <EmptyState titulo="Sin comerciales registrados" icono={Users} />
        ) : (
          <Card className="gap-0 rounded-lg p-0">
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
                        <Text className="text-sm font-semibold">{clientes.length}</Text>
                      </View>
                    </View>
                  </Pressable>
                  {i < comerciales.length - 1 && <Separator />}
                </View>
              );
            })}
          </Card>
        )}
      </ScreenScroll>

      {/* Modal: nuevo comercial */}
      <FormModal
        visible={modalAbierto}
        titulo="Nuevo comercial"
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
        <FormField etiqueta="Apellidos">
          <Input
            value={apellidos}
            onChangeText={setApellidos}
            placeholder="Apellidos"
            className="h-9 text-sm"
          />
        </FormField>
        <FormField etiqueta="Email" requerido>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            className="h-9 text-sm"
          />
        </FormField>
        <FormField etiqueta="Contraseña" requerido>
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Contraseña"
            secureTextEntry
            className="h-9 text-sm"
          />
        </FormField>
        {mensaje && <Text className="text-xs text-muted-foreground">{mensaje}</Text>}
      </FormModal>
    </>
  );
}
