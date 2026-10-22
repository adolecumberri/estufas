import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { RUTAS } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import { formatEUR, formatPct } from '@/lib/format';
import { fuenteImagen } from '@/lib/imagenes';
import { useColoresIcono } from '@/lib/theme';
import type { LineaSolicitud, ProductoCatalogo } from '@/lib/types';

const CANTIDAD_MIN = 1;
const CANTIDAD_MAX = 999;

// Tarjeta de producto del catálogo (diseño Stitch): cabecera con imagen y
// nombre, bloque central con referencia/precio y stepper, y botón "Añadir" a
// ancho completo (solo con sesión). `origen` es la etiqueta a la que se
// vuelve desde el detalle del producto. `onAnadir` llega por prop (estable
// vía useCallback) para que React.memo evite re-renderizar toda la rejilla
// con cada cambio del carrito.
function TarjetaProducto({
  producto,
  origen,
  onAnadir,
}: {
  producto: ProductoCatalogo;
  origen?: string;
  onAnadir: (linea: LineaSolicitud) => void;
}) {
  const { session, perfil } = useAuth();
  const [cantidad, setCantidad] = React.useState(1);
  const colores = useColoresIcono();

  // El admin navega el catálogo en SOLO LECTURA: sin stepper ni botón "Añadir".
  const esAdmin = perfil?.rol === 'admin';

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
      proveedor_id: producto.proveedor_id,
      proveedor_nombre: producto.proveedor_nombre,
    };
    onAnadir(linea);
  };

  return (
    <Pressable
      onPress={() =>
        router.push(
          `/catalogo/${producto.producto_id}${origen ? '?origen=' + encodeURIComponent(origen) : ''}`
        )
      }
      className="max-w-[50%] flex-1 active:opacity-80"
    >
      <Card className="flex-1 justify-between gap-0 overflow-hidden rounded-[10px] border border-border bg-background p-0 shadow-sm">
        {/* Bloque de cabecera: imagen con insignias + nombre */}
        <View>
          <View className="relative aspect-square w-full overflow-hidden bg-muted">
            <View className="h-full w-full p-2.5">
              <Image
                source={fuenteImagen(producto.imagen_url)}
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
          <View className="p-2.5">
            <Text numberOfLines={2} className="text-[13px] font-semibold leading-tight">
              {producto.nombre}
            </Text>
          </View>
        </View>

        {/* Divisor */}
        <View className="h-px bg-border" />

        {/* Bloque central: referencia + precio y stepper */}
        <View className="gap-1.5 p-2.5">
          {/* Referencia en su propia fila (no se corta en tarjetas estrechas) */}
          <Text numberOfLines={1} className="text-xs text-muted-foreground">
            Ref: {producto.referencia}
          </Text>

          {/* Proveedor (visible para saber si el carrito puede mezclarlo) */}
          {producto.proveedor_nombre && (
            <Text numberOfLines={1} className="text-[10px] text-muted-foreground">
              {producto.proveedor_nombre}
            </Text>
          )}

          {/* Fila de precio con estado fiscal, con ajuste de línea */}
          <View className="flex-row flex-wrap items-baseline gap-x-1.5">
            <Text className="text-sm font-bold">{formatEUR(producto.precio_final)}</Text>
            {producto.descuento_pct > 0 && (
              <Text className="text-[11px] text-muted-foreground line-through">
                {formatEUR(producto.precio_base)}
              </Text>
            )}
            <Text className="text-[10px] font-medium text-muted-foreground">Sin IVA</Text>
          </View>

          {/* Stepper de cantidad (cantidad que se añadirá); no para admin */}
          {!esAdmin && (
            <View className="mt-1 flex-row">
              <View className="flex-row items-center justify-between rounded-[10px] border border-border bg-muted px-1 py-0.5">
                <Pressable
                  accessibilityLabel="Reducir cantidad"
                  onPress={(e) => {
                    e.stopPropagation();
                    restar();
                  }}
                  className="h-6 w-6 items-center justify-center active:scale-90"
                >
                  <Minus size={16} color={colores.tenue} />
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
                  <Plus size={16} color={colores.tenue} />
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Botón "Añadir" a ancho completo (solo con sesión; no para admin) */}
        {session && !esAdmin && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Añadir ${producto.nombre} al pedido`}
            onPress={(e) => {
              e.stopPropagation();
              anadirAlPedido();
            }}
            className="m-2.5 mt-0 items-center rounded-[10px] bg-primary py-2"
          >
            <Text className="text-xs font-medium text-primary-foreground">Añadir</Text>
          </Pressable>
        )}
      </Card>
    </Pressable>
  );
}

export default React.memo(TarjetaProducto);
