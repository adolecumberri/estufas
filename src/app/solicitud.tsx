import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Minus, Plus, Trash2, UserRound } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSolicitud } from '@/contexts/solicitud-context';
import { useAuth } from '@/hooks/use-auth';
import { useAccionesPedido, usePedido } from '@/hooks/use-pedidos';
import { formatEUR } from '@/lib/format';

export default function Solicitud() {
  const insets = useSafeAreaInsets();
  const { session, perfil } = useAuth();
  const { lineas, clienteObjetivoId, setClienteObjetivoId, cambiarCantidad, quitar, reemplazar, vaciar, total } =
    useSolicitud();
  const { crear, editar } = useAccionesPedido();
  const params = useLocalSearchParams<{ editar?: string }>();
  const { detalle } = usePedido(params.editar);

  const [observaciones, setObservaciones] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [cargado, setCargado] = React.useState(false);

  // Modo edición: se cargan las líneas del pedido existente (los importes se
  // recalcularán en el servidor al guardar).
  React.useEffect(() => {
    if (!params.editar || !detalle || cargado) return;
    reemplazar(
      detalle.lineas.map((l) => ({
        producto_id: l.producto_id,
        referencia: l.referencia_producto,
        nombre: l.nombre_producto,
        cantidad: l.cantidad,
        precio_base: l.precio_unitario,
        precio_final: Number((l.precio_unitario * (1 - l.descuento_porcentaje / 100)).toFixed(2)),
        descuento_pct: l.descuento_porcentaje,
        descuento_origen: l.descuento_origen,
        imagen_url: null,
      }))
    );
    setObservaciones(detalle.pedido.observaciones ?? '');
    setCargado(true);
  }, [params.editar, detalle, cargado, reemplazar]);

  if (!session) return <Redirect href="/acceso" />;

  const enviar = async () => {
    setError(null);
    if (lineas.length === 0) {
      setError('Añade al menos un producto.');
      return;
    }
    if (perfil?.rol === 'comercial' && !clienteObjetivoId && !params.editar) {
      setError('Selecciona el cliente para el que creas el pedido.');
      return;
    }
    setEnviando(true);
    const lineasParaRpc = lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad }));
    if (params.editar) {
      const { error: err } = await editar(params.editar, lineasParaRpc, observaciones.trim() || undefined);
      setEnviando(false);
      if (err) {
        setError(err);
        return;
      }
      vaciar();
      setClienteObjetivoId(null);
      router.replace(`/pedidos/${params.editar}`);
      return;
    }
    const { pedido, error: err } = await crear({
      cliente_id: perfil?.rol === 'comercial' || perfil?.rol === 'admin' ? clienteObjetivoId : null,
      lineas: lineasParaRpc,
      observaciones: observaciones.trim() || undefined,
    });
    setEnviando(false);
    if (err || !pedido) {
      setError(err ?? 'No se pudo crear el pedido.');
      return;
    }
    vaciar();
    setClienteObjetivoId(null);
    router.replace(`/pedidos/${pedido.pedido_id}`);
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ paddingTop: insets.top + 8 }} className="gap-4 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold tracking-tight">
            {params.editar ? 'Editar solicitud' : 'Tu solicitud'}
          </Text>
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            <Text className="text-sm text-muted-foreground">Volver</Text>
          </Button>
        </View>

        {perfil?.rol === 'comercial' && !params.editar && (
          <Card>
            <CardContent className="flex-row items-center gap-3">
              <UserRound size={18} className="text-muted-foreground" />
              {clienteObjetivoId ? (
                <View className="flex-1 gap-1">
                  <Text className="text-sm font-medium">Pedido para un cliente asignado</Text>
                  <Text className="text-xs text-muted-foreground">
                    Los precios mostrados son los del cliente.
                  </Text>
                </View>
              ) : (
                <View className="flex-1">
                  <Text className="text-sm">Selecciona el cliente destinatario.</Text>
                </View>
              )}
              <Button
                variant="outline"
                size="sm"
                onPress={() => router.push(clienteObjetivoId ? '/cartera' : '/cartera')}
              >
                <Text>{clienteObjetivoId ? 'Cambiar' : 'Seleccionar'}</Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {lineas.length === 0 ? (
          <Card>
            <CardContent className="items-center gap-2 py-8">
              <Text className="text-muted-foreground">La solicitud está vacía.</Text>
              <Button variant="outline" size="sm" onPress={() => router.replace('/')}>
                <Text>Ver catálogo</Text>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <View className="gap-3">
            {lineas.map((l) => (
              <Card key={l.producto_id} className="p-3">
                <CardContent className="flex-row gap-3">
                  <Image
                    source={{ uri: l.imagen_url ?? undefined }}
                    className="h-16 w-16 rounded-md bg-muted"
                    contentFit="cover"
                  />
                  <View className="flex-1 gap-1">
                    <Text numberOfLines={2} className="text-sm font-medium">
                      {l.nombre}
                    </Text>
                    <Text className="text-xs text-muted-foreground">{l.referencia}</Text>
                    <Text className="text-sm font-semibold">{formatEUR(l.precio_final)}</Text>
                    {l.descuento_pct > 0 && (
                      <Text className="text-xs text-muted-foreground">
                        Incluye {l.descuento_pct.toLocaleString('es-ES')}% de descuento
                      </Text>
                    )}
                    <View className="mt-1 flex-row items-center gap-3">
                      <View className="flex-row items-center rounded-md border border-input">
                        <Pressable onPress={() => cambiarCantidad(l.producto_id, -1)} className="p-1.5 active:bg-accent">
                          <Minus size={14} className="text-foreground" />
                        </Pressable>
                        <Text className="w-8 text-center text-sm font-semibold">{l.cantidad}</Text>
                        <Pressable onPress={() => cambiarCantidad(l.producto_id, 1)} className="p-1.5 active:bg-accent">
                          <Plus size={14} className="text-foreground" />
                        </Pressable>
                      </View>
                      <Text className="text-sm text-muted-foreground">
                        = {formatEUR(l.precio_final * l.cantidad)}
                      </Text>
                      <Pressable onPress={() => quitar(l.producto_id)} className="ml-auto p-1.5 active:bg-accent">
                        <Trash2 size={16} className="text-destructive" />
                      </Pressable>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}

            <Separator />

            <View className="flex-row items-center justify-between px-1">
              <Text className="text-sm text-muted-foreground">Total (sin impuestos)</Text>
              <Text className="text-lg font-bold">{formatEUR(total)}</Text>
            </View>

            <View className="gap-1.5">
              <Label nativeID="observaciones">Observaciones (opcional)</Label>
              <Input
                id="observaciones"
                value={observaciones}
                onChangeText={setObservaciones}
                placeholder="Comentarios para tu solicitud"
                multiline
                numberOfLines={3}
                className="h-20 py-2 text-base"
              />
            </View>

            {error && <Text className="text-sm text-destructive">{error}</Text>}

            <Button disabled={enviando} onPress={() => void enviar()}>
              <Text>{enviando ? 'Enviando…' : params.editar ? 'Guardar cambios' : 'Enviar solicitud'}</Text>
            </Button>
            <Text className="text-center text-xs text-muted-foreground">
              Al enviar, la solicitud queda registrada y un comercial la revisará para confirmarla.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
