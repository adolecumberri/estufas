import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Minus, Plus } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ORIGENES_DESCUENTO } from '@/constants';
import { useSolicitud } from '@/contexts/solicitud-context';
import { useAuth } from '@/hooks/use-auth';
import { useProducto } from '@/hooks/use-producto';
import { formatEUR, formatPct } from '@/lib/format';

export default function ProductoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { clienteObjetivoId, anadir } = useSolicitud();
  const { producto, cargando, error } = useProducto(id, clienteObjetivoId);

  const [cantidad, setCantidad] = React.useState(1);

  // Agrupación de características por grupo. Hook SIEMPRE antes de los returns
  // condicionales (regla de hooks de React).
  const grupos = React.useMemo(() => {
    if (!producto) return [];
    const mapa = new Map<string, typeof producto.caracteristicas>();
    for (const c of producto.caracteristicas) {
      const lista = mapa.get(c.grupo) ?? [];
      lista.push(c);
      mapa.set(c.grupo, lista);
    }
    return Array.from(mapa.entries());
  }, [producto]);

  if (cargando) {
    return (
      <View className="flex-1 gap-4 bg-background p-4" style={{ paddingTop: insets.top + 8 }}>
        <Skeleton className="h-9 w-24" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-20 w-full" />
      </View>
    );
  }

  if (!producto || error) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background px-8">
        <Text className="text-center text-muted-foreground">
          {error ?? 'Producto no disponible.'}
        </Text>
        <Button variant="outline" onPress={() => router.back()}>
          <Text>Volver</Text>
        </Button>
      </View>
    );
  }

  const imagenes = [
    producto.imagen_url,
    ...producto.galeria.map((g) => g.url),
  ].filter((u): u is string => Boolean(u));

  const anadirASolicitud = () => {
    if (!session) {
      router.push('/acceso');
      return;
    }
    anadir({
      producto_id: producto.producto_id,
      referencia: producto.referencia,
      nombre: producto.nombre,
      cantidad,
      precio_base: producto.precio_base,
      precio_final: producto.precio_final,
      descuento_pct: producto.descuento_pct,
      descuento_origen: producto.descuento_origen,
      imagen_url: producto.imagen_url,
    });
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ paddingTop: insets.top + 8 }}>
        {/* 1. Cabecera: volver + referencia + etiqueta energética */}
        <View className="flex-row items-center gap-1 px-2">
          <Pressable
            onPress={() => router.back()}
            className="rounded-md p-2 active:bg-accent"
            accessibilityLabel="Volver"
          >
            <ChevronLeft size={24} className="text-foreground" />
          </Pressable>
          <Text className="flex-1 text-sm text-muted-foreground">
            Ref: {producto.referencia}
          </Text>
          {producto.etiqueta_energetica && (
            <Badge variant="outline" className="border-emerald-600">
              <Text className="text-xs font-medium text-emerald-600">
                {producto.etiqueta_energetica}
              </Text>
            </Badge>
          )}
        </View>

        {/* 2. Galería de imágenes */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          className="mt-2"
        >
          {imagenes.map((url, i) => (
            <Image
              key={`${url}-${i}`}
              source={{ uri: url }}
              className="h-80 w-screen bg-muted web:max-w-lg"
              contentFit="cover"
              transition={200}
            />
          ))}
        </ScrollView>

        <View className="gap-4 p-4">
          {/* 3. Título */}
          <View className="gap-2">
            <Text className="text-2xl font-bold tracking-tight">{producto.nombre}</Text>
            <Text className="text-sm text-muted-foreground">
              {producto.marca} · {producto.tipo}
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {producto.categorias.map((c) => (
                <Badge key={c} variant="secondary">
                  <Text>{c}</Text>
                </Badge>
              ))}
              {producto.etiqueta_energetica && (
                <Badge className="bg-emerald-600">
                  <Text className="text-white">Energía {producto.etiqueta_energetica}</Text>
                </Badge>
              )}
            </View>
          </View>

          {/* 4. Precio */}
          <Card>
            <CardContent className="gap-1">
              <View className="flex-row items-baseline gap-2">
                <Text className="text-2xl font-bold">{formatEUR(producto.precio_final)}</Text>
                {producto.descuento_pct > 0 && (
                  <Text className="text-sm text-muted-foreground line-through">
                    {formatEUR(producto.precio_base)}
                  </Text>
                )}
              </View>
              {producto.descuento_pct > 0 && (
                <Badge variant="secondary" className="self-start">
                  <Text>
                    {ORIGENES_DESCUENTO[producto.descuento_origen]?.etiqueta ?? 'Descuento'} ·{' '}
                    {formatPct(producto.descuento_pct)}
                  </Text>
                </Badge>
              )}
              <Text className="text-xs text-muted-foreground">
                Los precios no incluyen impuestos.
              </Text>
            </CardContent>
          </Card>

          {/* 5. Características agrupadas (antes de la descripción) */}
          {grupos.map(([grupo, caracteristicas]) => (
            <Card key={grupo}>
              <CardHeader>
                <CardTitle className="text-base">{grupo}</CardTitle>
              </CardHeader>
              <CardContent className="gap-0">
                {caracteristicas.map((c, i) => (
                  <React.Fragment key={c.clave}>
                    {i > 0 && <Separator className="my-2" />}
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm text-muted-foreground">{c.nombre}</Text>
                      <Text className="text-sm font-medium">
                        {typeof c.valor === 'boolean'
                          ? c.valor
                            ? 'Sí'
                            : 'No'
                          : c.valor}
                        {typeof c.valor !== 'boolean' && c.unidad ? ` ${c.unidad}` : ''}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </CardContent>
            </Card>
          ))}

          {/* 6. Descripción (debajo de las características) */}
          {producto.descripcion && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <Text className="leading-relaxed text-foreground">{producto.descripcion}</Text>
              </CardContent>
            </Card>
          )}

          {/* 7. Cantidad y añadir */}
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center rounded-[10px] border border-input">
              <Pressable
                onPress={() => setCantidad((c) => Math.max(1, c - 1))}
                className="p-3 active:bg-accent"
                accessibilityLabel="Restar"
              >
                <Minus size={16} className="text-foreground" />
              </Pressable>
              <Text className="w-10 text-center text-base font-semibold">{cantidad}</Text>
              <Pressable
                onPress={() => setCantidad((c) => Math.min(999, c + 1))}
                className="p-3 active:bg-accent"
                accessibilityLabel="Sumar"
              >
                <Plus size={16} className="text-foreground" />
              </Pressable>
            </View>
            <Button className="flex-1" onPress={anadirASolicitud}>
              <Text>Añadir a la solicitud</Text>
            </Button>
          </View>
          {clienteObjetivoId && (
            <Text className="text-center text-xs text-muted-foreground">
              Estás añadiendo productos para un cliente asignado: los precios mostrados son los suyos.
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
