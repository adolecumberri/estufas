import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { RUTAS } from '@/constants';
import { useSolicitud } from '@/contexts/solicitud-context';
import { useAuth } from '@/hooks/use-auth';
import { formatEUR, formatPct } from '@/lib/format';
import type { LineaSolicitud, ProductoCatalogo } from '@/lib/types';

const CANTIDAD_MIN = 1;
const CANTIDAD_MAX = 999;

// Tarjeta de producto del catálogo (diseño Stitch): imagen con insignias de
// energía/descuento, datos y fila de acción con stepper + botón "Añadir".
export function TarjetaProducto({ producto }: { producto: ProductoCatalogo }) {
  const { session } = useAuth();
  const { anadir } = useSolicitud();
  const [cantidad, setCantidad] = React.useState(1);

  const restar = () => setCantidad((c) => Math.max(CANTIDAD_MIN, c - 1));
  const sumar = () => setCantidad((c) => Math.min(CANTIDAD_MAX, c + 1));

  const anadirAlPedido = () => {
    if (!session) {
      router.push(RUTAS.login);
      return;
    }
    const linea: LineaSolicitud = {
      producto_id: producto.producto_id,
      referencia: producto.referencia,
      nombre: producto.nombre,
      cantidad,
      precio_base: producto.precio_base,
      precio_final: producto.precio_final,
      descuento_pct: producto.descuento_pct,
      descuento_origen: producto.descuento_origen,
      imagen_url: producto.imagen_url,
    };
    anadir(linea);
  };

  return (
    <Pressable
      onPress={() => router.push(`/catalogo/${producto.producto_id}`)}
      className="max-w-[50%] flex-1 active:opacity-80"
    >
      <Card className="flex-1 justify-between gap-0 overflow-hidden rounded-[10px] border border-border bg-background p-0 shadow-sm">
        <View>
          {/* Zona de imagen con insignias superpuestas */}
          <View className="relative aspect-square w-full overflow-hidden bg-muted">
            <View className="h-full w-full p-2.5">
              <Image
                source={{ uri: producto.imagen_url ?? undefined }}
                className="h-full w-full"
                contentFit="cover"
                transition={200}
              />
            </View>
            {producto.etiqueta_energetica && (
              <View className="absolute right-2 top-2 rounded bg-emerald-600 px-1.5 py-0.5">
                <Text className="text-[10px] font-bold text-white">{producto.etiqueta_energetica}</Text>
              </View>
            )}
            {producto.descuento_pct > 0 && (
              <View className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5">
                <Text className="text-[10px] font-bold text-primary-foreground">
                  -{formatPct(producto.descuento_pct)}
                </Text>
              </View>
            )}
          </View>

          {/* Datos del producto */}
          <View className="p-2.5">
            <Text numberOfLines={1} className="text-xs text-muted-foreground">
              {producto.marca ? `${producto.marca} · ` : ''}Ref: {producto.referencia}
            </Text>
            <Text numberOfLines={2} className="mt-0.5 text-[13px] font-semibold leading-tight">
              {producto.nombre}
            </Text>
            <View className="mt-2">
              <View className="flex-row items-baseline gap-1.5">
                <Text className="text-base font-bold">{formatEUR(producto.precio_final)}</Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                {producto.descuento_pct > 0 && (
                  <Text className="text-[11px] text-muted-foreground line-through">
                    {formatEUR(producto.precio_base)}
                  </Text>
                )}
                <Text className="text-[10px] font-medium text-muted-foreground">Sin IVA</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Fila de acción: stepper + Añadir */}
        <View className="flex-row items-center gap-1.5 p-2.5">
          <View className="flex-1 flex-row items-center justify-between rounded-[10px] border border-border bg-muted px-1 py-0.5">
            <Pressable
              accessibilityLabel="Reducir cantidad"
              onPress={(e) => {
                e.stopPropagation();
                restar();
              }}
              className="h-6 w-6 items-center justify-center active:scale-90"
            >
              <Minus size={16} className="text-muted-foreground" />
            </Pressable>
            <Text className="text-xs font-semibold">{cantidad}</Text>
            <Pressable
              accessibilityLabel="Aumentar cantidad"
              onPress={(e) => {
                e.stopPropagation();
                sumar();
              }}
              className="h-6 w-6 items-center justify-center active:scale-90"
            >
              <Plus size={16} className="text-muted-foreground" />
            </Pressable>
          </View>
          <Pressable
            accessibilityLabel={`Añadir ${producto.nombre} al pedido`}
            onPress={(e) => {
              e.stopPropagation();
              anadirAlPedido();
            }}
            className="rounded-[10px] bg-primary px-2.5 py-1.5 shadow-sm active:bg-primary/90"
          >
            <Text className="text-xs font-medium text-primary-foreground">Añadir</Text>
          </Pressable>
        </View>
      </Card>
    </Pressable>
  );
}
