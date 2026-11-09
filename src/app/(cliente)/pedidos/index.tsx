import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Building2, CheckCircle2, ChevronRight, RefreshCw, User } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { EmptyState, ErrorView, LoadingView } from '@/shared/componentes/estados';
import { ListCard } from '@/shared/componentes/list-card';
import { ScreenScroll } from '@/shared/componentes/screen';
import { ScreenHeader } from '@/shared/componentes/screen-header';
import { SectionTitle } from '@/shared/componentes/section-title';
import { NavInferior } from '@/shared/navegacion/nav-inferior';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Chip, IconButton } from '@/shared/ui';
import { Text } from '@/shared/ui/text';
import { ESTADOS_PEDIDO, type EstadoPedido } from '@/shared/constantes';
import { useAuth } from '@/features/auth/use-auth';
import { useCartera } from '@/features/cartera/hooks/use-comercial';
import { useAccionesPedido, usePedidos } from '@/features/pedidos/hooks/use-pedidos';
import { usePermisos } from '@/shared/seguridad/use-permisos';
import { formatEUR, formatFecha } from '@/shared/lib/format';
import { useColoresIcono } from '@/shared/lib/theme';
import type { Pedido } from '@/shared/lib/types';

// Chips de filtro: "Todos" más un chip por cada estado del enum real.
const FILTROS = ['todos', ...(Object.keys(ESTADOS_PEDIDO) as EstadoPedido[])] as const;
type Filtro = (typeof FILTROS)[number];

export default function Pedidos() {
  const colores = useColoresIcono();
  const { perfil } = useAuth();
  const { puede } = usePermisos();
  // Alcance opcional por comercial (`?comercial=<id>`): el admin, desde la
  // ficha de un comercial, ve SOLO los pedidos de ese comercial.
  const { comercial } = useLocalSearchParams<{ comercial?: string }>();
  const {
    pedidos,
    cargando: cargandoPedidos,
    error: errorPedidos,
    recargar,
  } = usePedidos(comercial);
  const { clientes } = useCartera(comercial);
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

  // Sección de pendientes: la ven el comercial y el admin (decisión 10/11/2026:
  // el admin opera pedidos de clientes). Subtítulo según el rol.
  const puedeConfirmar = puede('pedidos:confirmar');
  const etiquetaRol =
    perfil?.rol === 'comercial' ? 'Comercial' : perfil?.rol === 'admin' ? 'Admin' : null;
  const pendientes = pedidos.filter((p) => p.estado === 'solicitado');
  const pedidosFiltrados =
    filtro === 'todos' ? pedidos : pedidos.filter((p) => p.estado === filtro);

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
    <>
      <ScreenScroll contentClassName="pb-24">
        {/* Cabecera (el cierre de sesión vive en la navegación lateral) */}
        <ScreenHeader
          titulo="Pedidos"
          respaldo="/"
          subtitulo={
            etiquetaRol ? `${etiquetaRol} · ${perfil?.email ?? ''}` : (perfil?.email ?? '')
          }
          accion={
            <IconButton
              icono={RefreshCw}
              onPress={() => void recargar()}
              etiquetaAccesibilidad="Refrescar pedidos"
            />
          }
        />

        {/* Chips de filtro por estado (deslizables, con contadores) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {FILTROS.map((f) => {
            const cuenta =
              f === 'todos' ? pedidos.length : pedidos.filter((p) => p.estado === f).length;
            return (
              <Chip
                key={f}
                activo={filtro === f}
                onPress={() => setFiltro(f)}
                etiqueta={f === 'todos' ? 'Todos' : `${ESTADOS_PEDIDO[f].etiqueta} (${cuenta})`}
              />
            );
          })}
        </ScrollView>

        {cargandoPedidos ? (
          <LoadingView texto="Cargando pedidos…" />
        ) : errorPedidos ? (
          <ErrorView mensaje={errorPedidos} onReintentar={() => void recargar()} />
        ) : pedidos.length === 0 ? (
          <EmptyState
            titulo="Sin pedidos"
            descripcion="Añade productos a tu solicitud desde el catálogo para crear tu primer pedido."
            accion={
              <Button onPress={() => router.replace('/')}>
                <Text>Ver catálogo</Text>
              </Button>
            }
          />
        ) : (
          <View className="gap-5">
            {/* SECCIÓN 1: pedidos pendientes de confirmar (comercial y admin) */}
            {puedeConfirmar && (filtro === 'todos' || filtro === 'solicitado') && (
              <View className="gap-2">
                <SectionTitle
                  accion={
                    <View className="rounded-full bg-amber-100 px-2 py-0.5 dark:bg-amber-500/15">
                      <Text className="text-xs font-bold uppercase text-amber-700 dark:text-amber-400">
                        {pendientes.length} {pendientes.length === 1 ? 'pendiente' : 'pendientes'}
                      </Text>
                    </View>
                  }
                >
                  Pedidos pendientes de confirmar
                </SectionTitle>
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
                        <Card key={p.id} className="gap-3 rounded-lg p-3.5">
                          <View className="flex-row items-start justify-between gap-2">
                            <View className="flex-row items-center gap-2">
                              <Text className="text-sm font-semibold">
                                Pedido nº {p.numero_pedido}
                              </Text>
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
                              <Text className="text-xs text-muted-foreground">
                                Total sin impuestos
                              </Text>
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
              <SectionTitle
                accion={
                  <Text className="text-xs text-muted-foreground">
                    {pedidosFiltrados.length}{' '}
                    {pedidosFiltrados.length === 1 ? 'pedido registrado' : 'pedidos registrados'}
                  </Text>
                }
              >
                Historial de pedidos
              </SectionTitle>
              {pedidosFiltrados.length === 0 ? (
                <Text className="text-sm text-muted-foreground">
                  No hay pedidos con este estado.
                </Text>
              ) : (
                <View className="gap-2.5">
                  {pedidosFiltrados.map((p) => {
                    const numProductos = productosDe(p);
                    const cliente = clienteDe(p);
                    return (
                      <ListCard
                        key={p.id}
                        onPress={() => router.push(`/pedidos/${p.id}`)}
                        className="gap-2 p-3.5"
                      >
                        <View className="flex-row items-center justify-between gap-2">
                          <View className="flex-row items-center gap-2">
                            <Text className="text-sm font-semibold">
                              Pedido nº {p.numero_pedido}
                            </Text>
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
                      </ListCard>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}
      </ScreenScroll>

      <NavInferior activa="pedidos" />
    </>
  );
}
