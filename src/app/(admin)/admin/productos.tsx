import * as React from 'react';
import { View } from 'react-native';

import { ErrorView, LoadingView } from '@/components/comunes/estados';
import { ScreenScroll } from '@/components/comunes/screen';
import { ScreenHeader } from '@/components/comunes/screen-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useProductosAdmin } from '@/hooks/use-admin';
import { formatEUR } from '@/lib/format';

export default function AdminProductos() {
  const { productos, cargando, error, recargar, alternarPublicacion, actualizarPrecio } =
    useProductosAdmin();

  const [precios, setPrecios] = React.useState<Record<string, string>>({});
  const [mensaje, setMensaje] = React.useState<string | null>(null);

  const precioVigente = (producto: (typeof productos)[number]) => {
    const abiertos = (producto.producto_precios ?? []).filter((p) => !p.fecha_fin);
    const vigente = abiertos.sort((a, b) => (a.fecha_inicio < b.fecha_inicio ? 1 : -1))[0];
    return vigente?.precio ?? null;
  };

  const guardarPrecio = async (productoId: string) => {
    const valor = precios[productoId];
    if (!valor) return;
    const numero = Number(valor.replace(',', '.'));
    if (Number.isNaN(numero) || numero < 0) {
      setMensaje('Precio inválido.');
      return;
    }
    const { error } = await actualizarPrecio(productoId, numero);
    setMensaje(error ?? 'Precio actualizado.');
    setPrecios((prev) => ({ ...prev, [productoId]: '' }));
    if (!error) await recargar();
  };

  return (
    <ScreenScroll>
      <ScreenHeader titulo="Productos" respaldo="/admin" />

      {cargando ? (
        <LoadingView />
      ) : error ? (
        <ErrorView mensaje={error} />
      ) : (
        <View className="gap-3">
          {productos.map((p) => (
            <Card key={p.id} className="p-4">
              <CardContent className="gap-2">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="font-medium">{p.nombre}</Text>
                    <Text className="text-xs text-muted-foreground">{p.referencia}</Text>
                    {p.proveedor && (
                      <Text className="text-xs text-muted-foreground">{p.proveedor.nombre}</Text>
                    )}
                  </View>
                  <Badge variant={p.activo ? 'default' : 'outline'}>
                    <Text>{p.activo ? 'Publicado' : 'Borrador'}</Text>
                  </Badge>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm">
                    Precio vigente:{' '}
                    <Text className="font-semibold">{formatEUR(precioVigente(p))}</Text>
                  </Text>
                  <Button
                    size="sm"
                    variant={p.activo ? 'outline' : 'secondary'}
                    onPress={() =>
                      void (async () => {
                        const { error } = await alternarPublicacion(p.id, !p.activo);
                        setMensaje(error ?? 'Publicación actualizada.');
                        if (!error) await recargar();
                      })()
                    }
                  >
                    <Text className="text-xs">{p.activo ? 'Despublicar' : 'Publicar'}</Text>
                  </Button>
                </View>
                <View className="flex-row items-center gap-2">
                  <Input
                    keyboardType="decimal-pad"
                    value={precios[p.id] ?? ''}
                    onChangeText={(v) => setPrecios((prev) => ({ ...prev, [p.id]: v }))}
                    placeholder="Nuevo precio (EUR)"
                    className="h-9 flex-1 text-sm"
                  />
                  <Button size="sm" variant="secondary" onPress={() => void guardarPrecio(p.id)}>
                    <Text>Guardar</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          ))}
          <Separator />
          {mensaje && <Text className="text-sm text-muted-foreground">{mensaje}</Text>}
          <Text className="text-xs text-muted-foreground">
            La creación/edición completa de productos y recursos queda fuera del alcance inicial del
            MVP y se gestionará en la siguiente fase.
          </Text>
        </View>
      )}
    </ScreenScroll>
  );
}
