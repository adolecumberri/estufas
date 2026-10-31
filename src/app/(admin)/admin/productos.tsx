import { router } from 'expo-router';

import { volverA } from '@/lib/navegacion';
import { ChevronLeft } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useProductosAdmin } from '@/hooks/use-admin';
import { formatEUR } from '@/lib/format';
import { useColoresIcono } from '@/lib/theme';

export default function AdminProductos() {
  const insets = useSafeAreaInsets();
  const { productos, cargando, error, recargar, alternarPublicacion, actualizarPrecio } =
    useProductosAdmin();
  const colores = useColoresIcono();

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
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ paddingTop: insets.top + 8 }} className="gap-4 p-4">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => volverA('/admin')} className="rounded-md p-1 active:bg-accent">
            <ChevronLeft size={24} color={colores.primerPlano} />
          </Pressable>
          <Text className="text-xl font-bold tracking-tight">Productos</Text>
        </View>

        {cargando ? (
          <View className="items-center py-16">
            <ActivityIndicator color="hsl(124.3 17.7% 31%)" />
          </View>
        ) : error ? (
          <Text className="text-muted-foreground">{error}</Text>
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
      </View>
    </ScrollView>
  );
}
