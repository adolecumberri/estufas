import { router, useFocusEffect } from 'expo-router';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  ReceiptText,
  User,
  Zap,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavInferior } from '@/components/navegacion/nav-inferior';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { ESTADOS_PEDIDO, type EstadoPedido } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import { useCartera } from '@/hooks/use-comercial';
import { useAccionesPedido, usePedidos } from '@/hooks/use-pedidos';
import { formatEUR, formatFecha } from '@/lib/format';
import { useColoresIcono } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { Pedido } from '@/lib/types';

// Chips de filtro: "Todos" más un chip por cada estado del enum real.
const FILTROS = ['todos', ...(Object.keys(ESTADOS_PEDIDO) as EstadoPedido[])] as const;
type Filtro = (typeof FILTROS)[number];

export default function Pedidos() {
  const insets = useSafeAreaInsets();
  const colores = useColoresIcono();
  const { perfil } = useAuth();
  const { pedidos, cargando: cargandoPedidos, error: errorPedidos, recargar } = usePedidos();
  const { clientes } = useCartera();
  const { confirmar } = useAccionesPedido();

  // Filtro de estado activo (local) y confirmación en curso (id del pedido).
  const [filtro, setFiltro] = React.useState<Filtro>('todos');
  const [confirmando, setConfirmando] = React.useState<string | null>(null);
  const [mensajeConfirmar, setMensajeConfirmar] = React.useState<string | null>(null);

  // La primera carga ya la hace el hook al montar; en los siguientes enfoques
  // se refresca (la lista de pendientes queda al día al volver de confirmar).
  const primerEnfoque = React.useRef(true);
  useFocusEffect(
    React.useCallback(() => {
      if (primerEnfoque.current) {
        primerEnfoque.current = false;
        return;
      }
      void recargar();
    }, [recargar])
  );

  const esComercialOAdmin = perfil?.rol === 'comercial';
  // Subtítulo de la cabecera según el rol (el cliente solo ve su email).
  const etiquetaRol = perfil?.rol === 'comercial' ? 'Comercial' : null;
  const pendientes = pedidos.filter((p) => p.estado === 'solicitado');
  const pedidosFiltrados = filtro === 'todos' ? pedidos : pedidos.filter((p) => p.estado === filtro);

  // Totales del pedido y cliente asociado (desde la cartera del comercial).
  const totalDe = (p: Pedido) => (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.total_linea, 0);
  const productosDe = (p: Pedido) =>
    (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.cantidad, 0);
  const clienteDe = (p: Pedido) => clientes.find((c) => c.id === p.cliente_id) ?? null;
  const nombreClienteDe = (p: Pedido) => {
    const c = clienteDe(p);
    return c ? (c.razon_social ?? `${c.nombre} ${c.apellidos ?? ''}`.trim()) : null;
  };

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

  const confirmarPedido = async (pedidoId: string) => {
    setConfirmando(pedidoId);
    setMensajeConfirmar(null);
    const { error } = await confirmar(pedidoId, 'Pedido confirmado');
    setConfirmando(null);
    if (error) {
      setMensajeConfirmar(error);
      return;
    }
    // Refresca la lista: el pedido deja de estar pendiente.
    void recargar();
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 8 }}>
      {/* Cabecera (el cierre de sesión vive en la navegación lateral) */}
      <View className="flex-row items-center justify-between px-4 pb-2">
        <View className="gap-0.5">
          <Text className="text-xl font-bold tracking-tight">Pedidos</Text>
          <Text className="text-xs text-muted-foreground">
            {etiquetaRol ? `${etiquetaRol} · ${perfil?.email ?? ''}` : (perfil?.email ?? '')}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 + insets.bottom }}
      >
        {/* Chips de filtro por estado (deslizables) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}
        >
          {FILTROS.map((f) => {
            const activo = filtro === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFiltro(f)}
                className={cn(
                  'flex-row items-center gap-1.5 rounded-full px-3.5 py-1.5',
                  activo ? 'bg-primary/10' : 'bg-muted'
                )}
              >
                <Text
                  className={cn(
                    'text-xs',
                    activo ? 'font-semibold text-primary' : 'font-medium text-muted-foreground'
                  )}
                >
                  {f === 'todos' ? 'Todos' : ESTADOS_PEDIDO[f].etiqueta}
                </Text>
                {f !== 'todos' && (
                  <View
                    className={cn('rounded-full px-1.5 py-0.5', activo ? 'bg-primary/15' : 'bg-secondary')}
                  >
                    <Text
                      className={cn(
                        'text-[10px] font-bold',
                        activo ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      {pedidos.filter((p) => p.estado === f).length}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {cargandoPedidos ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="hsl(124.3 17.7% 31%)" />
          </View>
        ) : errorPedidos ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Text className="text-center text-muted-foreground">{errorPedidos}</Text>
          </View>
        ) : pedidos.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-4 px-8">
            <Text className="text-center text-muted-foreground">Aún no tienes pedidos.</Text>
            <Button onPress={() => router.replace('/')}>
              <Text>Ver catálogo</Text>
            </Button>
          </View>
        ) : (
          <View className="gap-5 p-4">
            {/* SECCIÓN 1: pedidos pendientes de confirmar (solo comercial/admin) */}
            {esComercialOAdmin && (filtro === 'todos' || filtro === 'solicitado') && (
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <Zap size={18} color={colores.primario} />
                    <Text className="text-base font-semibold">Pedidos pendientes de confirmar</Text>
                  </View>
                  <View className="rounded-full bg-amber-100 px-2 py-0.5 dark:bg-amber-500/15">
                    <Text className="text-xs font-bold uppercase text-amber-700 dark:text-amber-400">
                      {pendientes.length} {pendientes.length === 1 ? 'pendiente' : 'pendientes'}
                    </Text>
                  </View>
                </View>
                {pendientes.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">
                    No hay pedidos pendientes de confirmar.
                  </Text>
                ) : (
                  <View className="gap-2.5 rounded-xl bg-muted/60 p-2.5">
                    {pendientes.map((p) => {
                      const numProductos = productosDe(p);
                      const cliente = clienteDe(p);
                      return (
                        <Card key={p.id} className="gap-3 rounded-[10px] p-3.5">
                          <View className="flex-row items-start justify-between gap-2">
                            <View className="flex-row items-center gap-2">
                              <Text className="text-sm font-semibold">Pedido nº {p.numero_pedido}</Text>
                              <View className="rounded-full bg-amber-100 px-2 py-0.5 dark:bg-amber-500/15">
                                <Text className="text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                                  Requiere validación
                                </Text>
                              </View>
                            </View>
                            <Text className="text-xs text-muted-foreground">
                              {formatFecha(p.fecha_pedido)}
                            </Text>
                          </View>
                          <View className="flex-row items-center justify-between gap-2 rounded-lg bg-muted px-3 py-1.5">
                            <View className="flex-1 flex-row items-center gap-2">
                              {cliente?.razon_social ? (
                                <Building2 size={16} color={colores.tenue} />
                              ) : (
                                <User size={16} color={colores.tenue} />
                              )}
                              <Text className="flex-1 text-sm font-medium" numberOfLines={1}>
                                {nombreClienteDe(p) ?? 'Cliente sin asignar'}
                              </Text>
                            </View>
                            <Text className="text-xs text-muted-foreground">
                              {numProductos} {numProductos === 1 ? 'producto' : 'productos'}
                            </Text>
                          </View>
                          <View className="flex-row items-center justify-between gap-2 pt-0.5">
                            <View className="gap-0.5">
                              <Text className="text-xs text-muted-foreground">Total sin impuestos</Text>
                              <Text className="text-lg font-bold tracking-tight">
                                {formatEUR(totalDe(p))}
                              </Text>
                            </View>
                            <View className="flex-row items-center gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onPress={() => router.push(`/pedidos/${p.id}`)}
                              >
                                <Text>Detalle</Text>
                              </Button>
                              <Button
                                size="sm"
                                disabled={confirmando === p.id}
                                onPress={() => void confirmarPedido(p.id)}
                              >
                                {confirmando === p.id ? (
                                  <ActivityIndicator color={colores.primarioClaro} />
                                ) : (
                                  <CheckCircle2 size={16} color={colores.primarioClaro} />
                                )}
                                <Text>Confirmar</Text>
                              </Button>
                            </View>
                          </View>
                        </Card>
                      );
                    })}
                  </View>
                )}
                {mensajeConfirmar && (
                  <Text className="text-sm text-destructive">{mensajeConfirmar}</Text>
                )}
              </View>
            )}

            {/* SECCIÓN 2: historial general de pedidos */}
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <ReceiptText size={18} color={colores.tenue} />
                  <Text className="text-base font-semibold">Historial de pedidos</Text>
                </View>
                <Text className="text-xs text-muted-foreground">
                  {pedidosFiltrados.length}{' '}
                  {pedidosFiltrados.length === 1 ? 'pedido registrado' : 'pedidos registrados'}
                </Text>
              </View>
              {pedidosFiltrados.length === 0 ? (
                <Text className="text-sm text-muted-foreground">No hay pedidos con este estado.</Text>
              ) : (
                <View className="gap-2.5">
                  {pedidosFiltrados.map((p) => {
                    const numProductos = productosDe(p);
                    const cliente = clienteDe(p);
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => router.push(`/pedidos/${p.id}`)}
                        className="active:opacity-80"
                      >
                        <Card className="gap-2 rounded-[10px] p-3.5">
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
                            <View className="flex-1 flex-row items-center gap-1.5">
                              <Text className="text-xs text-muted-foreground">
                                {formatFecha(p.fecha_pedido)}
                              </Text>
                              <Text className="text-xs text-muted-foreground">·</Text>
                              <Text className="text-xs text-muted-foreground">
                                {numProductos} {numProductos === 1 ? 'producto' : 'productos'}
                              </Text>
                            </View>
                            <ChevronRight size={18} color={colores.tenue} />
                          </View>
                          <View className="flex-row items-center gap-1.5">
                            {cliente?.razon_social ? (
                              <Building2 size={14} color={colores.tenue} />
                            ) : (
                              <User size={14} color={colores.tenue} />
                            )}
                            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
                              {nombreClienteDe(p) ?? 'Cliente sin asignar'}
                            </Text>
                          </View>
                        </Card>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <NavInferior activa="pedidos" />
    </View>
  );
}
