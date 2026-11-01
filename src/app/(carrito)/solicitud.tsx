import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Minus, Plus, Trash2, UserRound, X } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/shared/componentes/estados';
import { ListCard } from '@/shared/componentes/list-card';
import { ScreenScroll } from '@/shared/componentes/screen';
import { ScreenHeader } from '@/shared/componentes/screen-header';
import { NavInferior } from '@/shared/navegacion/nav-inferior';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { IconButton } from '@/shared/ui';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Separator } from '@/shared/ui/separator';
import { Text } from '@/shared/ui/text';
import { useSolicitud } from '@/features/carrito/contexto';
import { useAuth } from '@/features/auth/use-auth';
import { useAccionesPedido, usePedido } from '@/features/pedidos/hooks/use-pedidos';
import { formatEUR } from '@/shared/lib/format';
import { fuenteImagen } from '@/features/catalogo/lib/imagenes';
import { useColoresIcono } from '@/shared/lib/theme';

export default function Solicitud() {
  const { perfil } = useAuth();
  const {
    lineas,
    clienteObjetivoId,
    setClienteObjetivoId,
    cambiarCantidad,
    quitar,
    reemplazar,
    vaciar,
    total,
    proveedorDelCarrito,
    aviso,
    limpiarAviso,
  } = useSolicitud();
  const { crear, editar } = useAccionesPedido();
  const params = useLocalSearchParams<{ editar?: string }>();
  const { detalle } = usePedido(params.editar);
  const colores = useColoresIcono();

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

  const enviar = async () => {
    setError(null);
    if (lineas.length === 0) {
      setError('Añade al menos un producto.');
      return;
    }
    if (
      (perfil?.rol === 'comercial' || perfil?.rol === 'admin') &&
      !clienteObjetivoId &&
      !params.editar
    ) {
      setError('Selecciona el cliente para el que creas el pedido.');
      return;
    }
    setEnviando(true);
    const lineasParaRpc = lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad }));
    if (params.editar) {
      const { error: err } = await editar(
        params.editar,
        lineasParaRpc,
        observaciones.trim() || undefined
      );
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
    <>
      <ScreenScroll contentClassName="pb-24">
        <ScreenHeader
          titulo={params.editar ? 'Editar solicitud' : 'Solicitud'}
          respaldo={params.editar ? `/pedidos/${params.editar}` : '/'}
          subtitulo={proveedorDelCarrito ? `Proveedor: ${proveedorDelCarrito.nombre}` : undefined}
        />

        {/* Aviso global del carrito (p. ej. intento de mezclar proveedores) */}
        {aviso && (
          <Card className="gap-0 rounded-lg border-primary/40 bg-primary/10 p-3">
            <View className="flex-row items-start gap-2">
              <Text className="flex-1 text-sm">{aviso}</Text>
              <IconButton icono={X} onPress={limpiarAviso} etiquetaAccesibilidad="Cerrar aviso" />
            </View>
          </Card>
        )}

        {(perfil?.rol === 'comercial' || perfil?.rol === 'admin') && !params.editar && (
          <Card className="gap-0 rounded-lg border-primary/40 bg-primary/10 p-3">
            <CardContent className="flex-row items-center gap-3 px-0">
              <UserRound size={18} color={colores.tenue} />
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
                onPress={() =>
                  clienteObjetivoId ? setClienteObjetivoId(null) : router.push('/cartera')
                }
              >
                <Text>{clienteObjetivoId ? 'Cambiar' : 'Seleccionar'}</Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {lineas.length === 0 ? (
          <EmptyState
            titulo="Tu solicitud está vacía."
            descripcion="Añade productos desde el catálogo para preparar tu pedido."
            accion={
              <Button onPress={() => router.replace('/')}>
                <Text>Ver catálogo</Text>
              </Button>
            }
          />
        ) : (
          <View className="gap-3">
            {lineas.map((l) => (
              <ListCard key={l.producto_id} className="gap-3 p-3">
                <View className="flex-row gap-3">
                  <Image
                    source={fuenteImagen(l.imagen_url) ?? undefined}
                    className="h-14 w-14 rounded-md bg-muted"
                    contentFit="cover"
                  />
                  <View className="flex-1 gap-1">
                    <Text numberOfLines={2} className="text-sm font-medium">
                      {l.nombre}
                    </Text>
                    <Text className="text-xs text-muted-foreground">{l.referencia}</Text>
                    <View className="flex-row flex-wrap items-baseline gap-x-1.5">
                      <Text className="text-sm font-semibold">{formatEUR(l.precio_final)}</Text>
                      {l.descuento_pct > 0 && (
                        <Text className="text-xs text-muted-foreground line-through">
                          {formatEUR(l.precio_base)}
                        </Text>
                      )}
                    </View>
                    {l.descuento_pct > 0 && (
                      <Text className="text-xs text-muted-foreground">
                        Incluye {l.descuento_pct.toLocaleString('es-ES')}% de descuento
                      </Text>
                    )}
                    <View className="mt-1 flex-row items-center gap-3">
                      <View className="flex-row items-center rounded-lg border border-border">
                        <Pressable
                          onPress={() => cambiarCantidad(l.producto_id, -1)}
                          className="p-1.5 active:bg-accent"
                        >
                          <Minus size={14} color={colores.primerPlano} />
                        </Pressable>
                        <Text className="w-8 text-center text-sm font-semibold">{l.cantidad}</Text>
                        <Pressable
                          onPress={() => cambiarCantidad(l.producto_id, 1)}
                          className="p-1.5 active:bg-accent"
                        >
                          <Plus size={14} color={colores.primerPlano} />
                        </Pressable>
                      </View>
                      <Text className="text-sm font-semibold">
                        {formatEUR(l.precio_final * l.cantidad)}
                      </Text>
                      <Pressable
                        onPress={() => quitar(l.producto_id)}
                        className="ml-auto p-1.5 active:bg-accent"
                      >
                        <Trash2 size={16} color={colores.destructivo} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </ListCard>
            ))}

            <Separator />

            <View className="flex-row items-center justify-between px-1">
              <Text className="text-sm font-semibold">Total (sin impuestos)</Text>
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
              <Text>
                {enviando ? 'Enviando…' : params.editar ? 'Guardar cambios' : 'Enviar solicitud'}
              </Text>
            </Button>
            <Text className="text-center text-xs text-muted-foreground">
              Al enviar, la solicitud queda registrada y un comercial la revisará para confirmarla.
            </Text>
          </View>
        )}
      </ScreenScroll>

      <NavInferior activa="solicitud" />
    </>
  );
}
