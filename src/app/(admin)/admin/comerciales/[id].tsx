import { router, useLocalSearchParams } from 'expo-router';
import { FilePlus2, Flame, ReceiptText, User, Wallet } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TarjetaCliente } from '@/components/cartera/tarjeta-cliente';
import { EmptyState, ErrorView, LoadingView } from '@/components/comunes/estados';
import { Screen } from '@/components/comunes/screen';
import { ScreenHeader } from '@/components/comunes/screen-header';
import { SectionTitle } from '@/components/comunes/section-title';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { ESTADOS_PEDIDO, type EstadoPedido } from '@/constants';
import { useComercialDetalle } from '@/hooks/use-admin';
import { formatEUR, formatFecha } from '@/lib/format';
import { useColoresIcono } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { Pedido, PerfilUsuario } from '@/lib/types';

// Misma variante de Badge por estado que en la lista de pedidos del comercial.
const varianteEstado = (estado: EstadoPedido) => {
  switch (estado) {
    case 'solicitado':
      return 'secondary' as const;
    case 'confirmado':
      return 'default' as const;
    case 'en_preparacion':
      return 'outline' as const;
    case 'completado':
      return 'secondary' as const;
    case 'cancelado':
      return 'destructive' as const;
  }
};

const nombreDe = (c: PerfilUsuario | null | undefined) =>
  c ? (c.razon_social ?? `${c.nombre} ${c.apellidos ?? ''}`.trim()) : null;

// Pestañas del footer de la vista previa: mismo aspecto que NavInferior, pero
// con el estado local de esta pantalla (Catálogo navega, Solicitud no aplica).
type SeccionPreview = 'cartera' | 'pedidos';

const PESTANAS_PREVIEW = [
  { id: 'catalogo', etiqueta: 'Catálogo', icono: Flame },
  { id: 'solicitud', etiqueta: 'Solicitud', icono: FilePlus2 },
  { id: 'pedidos', etiqueta: 'Pedidos', icono: ReceiptText },
  { id: 'cartera', etiqueta: 'Cartera', icono: Wallet },
] as const;

export default function AdminComercialDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colores = useColoresIcono();
  const { comercial, clientes, pedidos, cargando, error, recargar } = useComercialDetalle(id);

  // Vista activa del "app del comercial": Cartera por defecto.
  const [seccion, setSeccion] = React.useState<SeccionPreview>('cartera');

  const totalDe = (p: Pedido) => (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.total_linea, 0);
  const productosDe = (p: Pedido) =>
    (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.cantidad, 0);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
      >
        <View className="gap-4 p-4">
          {/* Cabecera: nombre y email del comercial */}
          <ScreenHeader
            titulo={comercial ? `${comercial.nombre} ${comercial.apellidos ?? ''}`.trim() : 'Comercial'}
            subtitulo={comercial?.email ?? ''}
            respaldo="/admin/comerciales"
          />

          {cargando ? (
            <LoadingView />
          ) : error ? (
            <ErrorView mensaje={error} onReintentar={() => void recargar()} />
          ) : !comercial ? (
            <EmptyState titulo="Comercial no encontrado" />
          ) : seccion === 'cartera' ? (
            /* Sección Cartera: clientes del comercial con la tarjeta reutilizable */
            <View className="gap-3">
              <View className="gap-0.5">
                <SectionTitle>Cartera</SectionTitle>
                <Text className="text-xs text-muted-foreground">
                  Vista de administración · solo lectura
                </Text>
              </View>
              {clientes.length === 0 ? (
                <Text className="text-sm text-muted-foreground">Sin clientes asignados</Text>
              ) : (
                clientes.map((c) => (
                  /* El admin abre la ficha del cliente (cartera) para ver sus
                     condiciones y crearle una solicitud de pedido. La tarjeta
                     ya trae chevron y es un Pressable accesible. */
                  <TarjetaCliente
                    key={c.id}
                    cliente={c}
                    onPress={() => router.push(`/cartera/${c.id}`)}
                  />
                ))
              )}
            </View>
          ) : (
            /* Sección Pedidos: mismos datos y filas que la vista anterior */
            <View className="gap-3">
              <View className="gap-0.5">
                <SectionTitle>Pedidos</SectionTitle>
                <Text className="text-xs text-muted-foreground">
                  Vista de administración · solo lectura
                </Text>
              </View>
              {pedidos.length === 0 ? (
                <Text className="text-sm text-muted-foreground">Sin pedidos registrados</Text>
              ) : (
                pedidos.map((p) => (
                  <View key={p.id} className="gap-1.5 rounded-md border border-border p-3">
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-semibold">Pedido nº {p.numero_pedido}</Text>
                        <Badge variant={varianteEstado(p.estado)}>
                          <Text>{ESTADOS_PEDIDO[p.estado].etiqueta}</Text>
                        </Badge>
                      </View>
                      <Text className="text-sm font-bold">{formatEUR(totalDe(p))}</Text>
                    </View>
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="text-xs text-muted-foreground">
                        {formatFecha(p.fecha_pedido)}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {productosDe(p)} {productosDe(p) === 1 ? 'producto' : 'productos'}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <User size={14} color={colores.tenue} />
                      <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
                        {nombreDe(p.cliente) ?? 'Cliente sin asignar'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer estilo NavInferior (duplicado a propósito: no modifica el
          componente compartido). Catálogo navega al catálogo real en solo
          lectura; Solicitud no aplica en la vista de admin (sin onPress). */}
      <View
        className="absolute bottom-0 left-0 right-0 h-16 flex-row items-center justify-around border-t border-border bg-background px-2"
        style={{ height: 64 + insets.bottom, paddingBottom: insets.bottom }}
      >
        {PESTANAS_PREVIEW.map(({ id, etiqueta, icono: Icono }) => {
          const esActiva = id === seccion;
          const sinAccion = id === 'solicitud';
          return (
            <Pressable
              key={id}
              disabled={sinAccion}
              onPress={() => {
                if (id === 'catalogo') {
                  // El catálogo vive en la ruta raíz ('/') y el admin lo ve en
                  // solo lectura (sin carrito ni botones de añadir).
                  router.push('/');
                  return;
                }
                if (id === 'solicitud') return; // deshabilitada: sin acción.
                setSeccion(id);
              }}
              className={cn(
                'relative flex-col items-center justify-center gap-0.5 py-1 active:opacity-70',
                sinAccion && 'opacity-40'
              )}
            >
              <Icono size={24} color={esActiva ? colores.primario : colores.tenue} />
              <Text
                className={cn(
                  'text-[11px] leading-tight',
                  esActiva ? 'font-medium text-primary' : 'text-muted-foreground'
                )}
              >
                {etiqueta}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
