import { Redirect, router, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  CircleCheck,
  Flame,
  Mail,
  Percent,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { COMBUSTIBLES, ESTADOS_PEDIDO, TIPOS_CLIENTE } from '@/constants';
import type { CombustibleId } from '@/constants';
import { useSolicitud } from '@/contexts/solicitud-context';
import { useAuth } from '@/hooks/use-auth';
import { useCatalogo } from '@/hooks/use-catalogo';
import { useCliente, useDescuentos } from '@/hooks/use-comercial';
import { usePedidos } from '@/hooks/use-pedidos';
import { formatEUR, formatPct } from '@/lib/format';
import { useColoresIcono } from '@/lib/theme';

const DESCRIPCIONES_COMBUSTIBLE: Record<CombustibleId, string> = {
  pellets: 'Canalizadas, Aire y Autónomas',
  lena: 'Fundición, Cassette e Insert',
};

const CHIPS_GENERAL = [5, 10, 15, 20];
const CHIPS_PRODUCTO = [0, 8, 12, 15, 20];

export default function ClienteDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { session, perfil } = useAuth();
  const { setClienteObjetivoId } = useSolicitud();
  const { cliente, descuentos, descuentosCombustible, cargando, recargar } = useCliente(id);
  const {
    asignarGeneral,
    asignarProducto,
    anularProducto,
    asignarCombustible,
    anularCombustible,
  } = useDescuentos();
  const { pedidos } = usePedidos();
  const catalogo = useCatalogo(id);
  const colores = useColoresIcono();

  const [pctGeneral, setPctGeneral] = React.useState('');
  const [productoSeleccionado, setProductoSeleccionado] = React.useState<string | null>(null);
  const [pctProducto, setPctProducto] = React.useState('');
  const [pctCombustibles, setPctCombustibles] = React.useState<{ pellets: string; lena: string }>({
    pellets: '',
    lena: '',
  });
  const [anadiendo, setAnadiendo] = React.useState(false);
  const [mensaje, setMensaje] = React.useState<string | null>(null);

  // Pre-rellena el valor del descuento general con el vigente al cargar
  // (y tras guardar, cuando recargar() refresca el cliente).
  React.useEffect(() => {
    if (cliente && cliente.descuento_porcentaje > 0) {
      setPctGeneral(String(cliente.descuento_porcentaje));
    }
  }, [cliente]);

  if (!session) return <Redirect href="/acceso" />;
  // El admin no gestiona cartera de clientes: vuelve a su panel.
  if (perfil?.rol === 'admin') return <Redirect href="/admin" />;

  const puedeGestionar = perfil?.rol === 'comercial';
  if (perfil && !puedeGestionar) return <Redirect href="/pedidos" />;

  const pedidosDelCliente = pedidos.filter((p) => p.cliente_id === id);

  const guardarGeneral = async () => {
    const pct = Number(pctGeneral.replace(',', '.'));
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setMensaje('Porcentaje inválido (0-100).');
      return;
    }
    const { error } = await asignarGeneral(id!, pct);
    setMensaje(error ?? 'Descuento general actualizado.');
    if (!error) await recargar();
  };

  const guardarProducto = async () => {
    if (!productoSeleccionado) return;
    const pct = Number(pctProducto.replace(',', '.'));
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setMensaje('Porcentaje inválido (0-100).');
      return;
    }
    const { error } = await asignarProducto(id!, productoSeleccionado, pct);
    setMensaje(error ?? 'Descuento específico guardado.');
    setProductoSeleccionado(null);
    setPctProducto('');
    if (!error) {
      setAnadiendo(false);
      await recargar();
    }
  };

  const anularDescuentoProducto = async (productoId: string) => {
    const { error } = await anularProducto(id!, productoId);
    setMensaje(error ?? 'Descuento anulado.');
    if (!error) await recargar();
  };

  const guardarCombustible = async (combustible: CombustibleId, valor: string) => {
    const texto = valor.trim().replace(',', '.');
    const pct = Number(texto);
    if (texto === '' || Number.isNaN(pct) || pct < 0 || pct > 100) {
      setMensaje('Porcentaje inválido (0-100).');
      return;
    }
    const { error } = await asignarCombustible(id!, combustible, pct);
    setMensaje(error ?? 'Descuento por combustible actualizado.');
    if (!error) await recargar();
  };

  const anularCombustibleDescuento = async (combustible: CombustibleId) => {
    const { error } = await anularCombustible(id!, combustible);
    setMensaje(error ?? 'Descuento por combustible anulado.');
    if (!error) await recargar();
  };

  const empezarPedido = () => {
    setClienteObjetivoId(id ?? null);
    router.replace('/');
  };

  if (cargando || !cliente) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="hsl(124.3 17.7% 31%)" />
      </View>
    );
  }

  const productoElegido = catalogo.productos.find((p) => p.producto_id === productoSeleccionado);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View style={{ paddingTop: insets.top + 8 }} className="gap-4 p-4">
        {/* Cabecera */}
        <View className="gap-2">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 self-start px-1 py-1 active:bg-accent"
          >
            <ChevronLeft size={18} color={colores.primerPlano} />
            <Text className="text-sm font-medium text-muted-foreground">Volver a Cartera</Text>
          </Pressable>
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-2xl font-bold tracking-tight">Condiciones y Descuentos</Text>
            {cliente.tipo_cliente ? (
              <Badge variant="secondary">
                <Text className="uppercase">{TIPOS_CLIENTE[cliente.tipo_cliente].etiqueta}</Text>
              </Badge>
            ) : null}
          </View>
        </View>

        {/* Tarjeta del cliente */}
        <Card className="rounded-[10px]">
          <CardContent className="gap-1.5">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-semibold" numberOfLines={2}>
                  {cliente.razon_social ?? `${cliente.nombre} ${cliente.apellidos ?? ''}`.trim()}
                </Text>
                {cliente.nif_cif ? (
                  <Text className="text-sm text-muted-foreground">CIF {cliente.nif_cif}</Text>
                ) : null}
              </View>
              <View className="flex-row items-center gap-1">
                <CircleCheck size={14} color={cliente.activo ? colores.primario : colores.tenue} />
                <Text
                  className={
                    cliente.activo
                      ? 'text-xs font-medium text-primary'
                      : 'text-xs font-medium text-muted-foreground'
                  }
                >
                  {cliente.activo ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
            </View>
            <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <Mail size={14} color={colores.tenue} />
              <Text className="text-sm text-muted-foreground">{cliente.email}</Text>
              {cliente.tipo_cliente === 'empresa' ? (
                <>
                  <View className="h-1 w-1 rounded-full bg-border" />
                  <Text className="text-sm font-medium text-primary">Tarifa Profesional</Text>
                </>
              ) : null}
            </View>
            {cliente.telefono ? <Text className="text-sm">{cliente.telefono}</Text> : null}
          </CardContent>
        </Card>

        <Button onPress={empezarPedido}>
          <Text>Crear pedido para este cliente</Text>
        </Button>

        {/* Descuento general de cartera */}
        <Card className="rounded-[10px]">
          <CardHeader className="gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-2">
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Percent size={20} color={colores.primario} />
                </View>
                <View className="flex-1 gap-0.5">
                  <CardTitle className="text-base font-semibold">
                    Descuento General de Cartera
                  </CardTitle>
                  <Text className="text-xs text-muted-foreground">Base para todos los pedidos</Text>
                </View>
              </View>
              {cliente.descuento_porcentaje > 0 ? (
                <View className="flex-row items-center gap-1">
                  <CircleCheck size={14} color={colores.primario} />
                  <Text className="text-xs font-medium text-primary">Activo</Text>
                </View>
              ) : (
                <Text className="text-xs font-medium text-muted-foreground">Inactivo</Text>
              )}
            </View>
          </CardHeader>
          <CardContent className="gap-3">
            <Text className="text-xs text-muted-foreground">
              Se aplica por defecto a todos los productos, salvo excepciones de producto o
              promociones de tienda superiores.
            </Text>
            <View className="gap-2 rounded-lg bg-muted p-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Valor Porcentual
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Actual: {formatPct(cliente.descuento_porcentaje)}
                </Text>
              </View>
              <View className="flex-row flex-wrap items-center gap-2">
                <Input
                  keyboardType="decimal-pad"
                  value={pctGeneral}
                  onChangeText={setPctGeneral}
                  placeholder="%"
                  className="h-10 w-24 text-sm"
                />
                <View className="flex-row flex-wrap gap-1.5">
                  {CHIPS_GENERAL.map((pct) => {
                    const seleccionado = pctGeneral === String(pct);
                    return (
                      <Pressable
                        key={pct}
                        onPress={() => setPctGeneral(String(pct))}
                        className={
                          seleccionado
                            ? 'rounded-full border border-primary bg-primary px-3 py-1.5'
                            : 'rounded-full border border-border px-3 py-1.5'
                        }
                      >
                        <Text
                          className={
                            seleccionado
                              ? 'text-xs font-semibold text-primary-foreground'
                              : 'text-xs'
                          }
                        >
                          {pct}%
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                onPress={() => void guardarGeneral()}
              >
                <Text>Aplicar</Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        {/* Por categoría técnica (descuento por combustible) */}
        <View className="gap-2">
          <View>
            <Text className="text-base font-semibold">Por Categoría Técnica</Text>
            <Text className="text-xs text-muted-foreground">
              {descuentosCombustible.length} reglas activas en catálogo
            </Text>
          </View>
          {COMBUSTIBLES.map((c) => {
            const descuento = descuentosCombustible.find((d) => d.combustible === c.id);
            return (
              <Card key={c.id} className="rounded-[10px]">
                <CardContent className="gap-3">
                  <View className="flex-row items-center justify-between gap-2">
                    <View className="flex-row items-center gap-2">
                      <View className="h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <Flame size={18} color={colores.primerPlano} />
                      </View>
                      <View className="flex-1 gap-0.5">
                        <Text className="text-sm font-semibold">{c.etiqueta}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {DESCRIPCIONES_COMBUSTIBLE[c.id]}
                        </Text>
                      </View>
                    </View>
                    {descuento ? (
                      <View className="rounded-md bg-primary/10 px-2 py-1">
                        <Text className="text-xs font-semibold text-primary">
                          {formatPct(descuento.descuento_porcentaje)} Dto.
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-xs text-muted-foreground">Sin descuento</Text>
                    )}
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Input
                      keyboardType="decimal-pad"
                      value={pctCombustibles[c.id]}
                      onChangeText={(v) =>
                        setPctCombustibles((prev) => {
                          const siguiente = { ...prev };
                          siguiente[c.id] = v;
                          return siguiente;
                        })
                      }
                      placeholder="%"
                      className="h-10 w-24 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => void guardarCombustible(c.id, pctCombustibles[c.id])}
                    >
                      <Text>Guardar</Text>
                    </Button>
                    {descuento ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => void anularCombustibleDescuento(c.id)}
                      >
                        <Text className="text-xs">Anular</Text>
                      </Button>
                    ) : null}
                  </View>
                </CardContent>
              </Card>
            );
          })}
        </View>

        {/* Descuentos por producto */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1">
              <Text className="text-base font-semibold">Descuentos por Producto</Text>
              <Text className="text-xs text-muted-foreground">
                {descuentos.length} referencias con tarifa individualizada
              </Text>
            </View>
            <Button
              size="sm"
              variant="outline"
              onPress={() => {
                setAnadiendo((v) => !v);
                setProductoSeleccionado(null);
              }}
            >
              <Plus size={14} color={colores.primario} />
              <Text className="text-xs">Añadir Producto</Text>
            </Button>
          </View>

          {descuentos.length === 0 ? (
            <Text className="text-sm text-muted-foreground">Sin descuentos específicos.</Text>
          ) : null}
          {descuentos.map((d) => {
            const producto = catalogo.productos.find((p) => p.producto_id === d.producto_id);
            return (
              <Card key={d.id} className="rounded-[10px]">
                <CardContent className="gap-2">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1 gap-0.5">
                      <Text className="text-xs text-muted-foreground">
                        Ref. {producto?.referencia ?? d.producto_id}
                      </Text>
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {producto?.nombre ?? d.producto_id}
                      </Text>
                      {producto ? (
                        <View className="flex-row items-baseline gap-2">
                          <Text className="text-xs text-muted-foreground line-through">
                            {formatEUR(producto.precio_base)}
                          </Text>
                          <Text className="text-sm font-bold text-primary">
                            {formatEUR(producto.precio_final)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View className="items-end gap-1.5">
                      <View className="rounded-full bg-primary/10 px-2 py-0.5">
                        <Text className="text-xs font-bold text-primary">
                          {d.descuento_porcentaje === 0
                            ? '0% EXCLUIDO'
                            : `-${formatPct(d.descuento_porcentaje)} DTO`}
                        </Text>
                      </View>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onPress={() => void anularDescuentoProducto(d.producto_id)}
                      >
                        <Trash2 size={16} color={colores.destructivo} />
                      </Button>
                    </View>
                  </View>
                </CardContent>
              </Card>
            );
          })}

          {anadiendo ? (
            <Card className="rounded-[10px]">
              <CardContent className="gap-3">
                <Text className="text-sm font-semibold">Añadir descuento por producto</Text>
                <Text className="text-xs text-muted-foreground">
                  Sustituye al descuento general para ese producto; 0% = excluirlo.
                </Text>
                <View className="flex-row items-center gap-2">
                  <Search size={16} color={colores.tenue} />
                  <Input
                    value={catalogo.busqueda}
                    onChangeText={catalogo.setBusqueda}
                    placeholder="Buscar por referencia o modelo…"
                    className="h-10 flex-1 text-sm"
                  />
                </View>
                {catalogo.cargando ? (
                  <ActivityIndicator color="hsl(124.3 17.7% 31%)" />
                ) : catalogo.productos.length === 0 ? (
                  <Text className="text-sm text-muted-foreground">Sin resultados.</Text>
                ) : (
                  catalogo.productos.map((p) => {
                    const seleccionado = productoSeleccionado === p.producto_id;
                    return (
                      <Pressable
                        key={p.producto_id}
                        onPress={() => setProductoSeleccionado(p.producto_id)}
                        className={
                          seleccionado
                            ? 'rounded-md border border-primary bg-primary/5 p-2'
                            : 'rounded-md border border-border p-2 active:bg-accent'
                        }
                      >
                        <View className="flex-row items-center justify-between gap-2">
                          <View className="flex-1 gap-0.5">
                            <Text className="text-sm font-medium" numberOfLines={1}>
                              {p.nombre}
                            </Text>
                            <Text className="text-xs text-muted-foreground">
                              Ref. {p.referencia} · {formatEUR(p.precio_base)}
                            </Text>
                          </View>
                          <Text className="text-sm font-semibold">{formatEUR(p.precio_final)}</Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}
                {productoSeleccionado ? (
                  <View className="gap-2">
                    <Separator />
                    <Text className="text-xs text-muted-foreground">
                      Producto seleccionado: {productoElegido?.nombre ?? productoSeleccionado}
                    </Text>
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Input
                        keyboardType="decimal-pad"
                        value={pctProducto}
                        onChangeText={setPctProducto}
                        placeholder="%"
                        className="h-10 w-24 text-sm"
                      />
                      <View className="flex-row flex-wrap gap-1.5">
                        {CHIPS_PRODUCTO.map((pct) => {
                          const seleccionado = pctProducto === String(pct);
                          return (
                            <Pressable
                              key={pct}
                              onPress={() => setPctProducto(String(pct))}
                              className={
                                seleccionado
                                  ? 'rounded-full border border-primary bg-primary px-3 py-1.5'
                                  : 'rounded-full border border-border px-3 py-1.5'
                              }
                            >
                              <Text
                                className={
                                  seleccionado
                                    ? 'text-xs font-semibold text-primary-foreground'
                                    : 'text-xs'
                                }
                              >
                                {pct === 0 ? '0% (Excl.)' : `${pct}%`}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View className="flex-row gap-2">
                      <Button size="sm" onPress={() => void guardarProducto()}>
                        <Text>Añadir descuento</Text>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => {
                          setProductoSeleccionado(null);
                          setPctProducto('');
                        }}
                      >
                        <Text className="text-xs">Cancelar</Text>
                      </Button>
                    </View>
                  </View>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </View>

        {/* Nota de auditoría */}
        <View className="flex-row items-start gap-2 rounded-xl bg-muted p-3">
          <ShieldCheck size={18} color={colores.primario} className="mt-0.5 shrink-0" />
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-semibold">
              Condiciones vinculadas a {cliente.nif_cif ? `CIF ${cliente.nif_cif}` : 'esta cuenta'}
            </Text>
            <Text className="text-xs text-muted-foreground">
              Las modificaciones quedan registradas en el historial de auditoría comercial de la
              cuenta y entran en vigor de forma inmediata en las cotizaciones vigentes.
            </Text>
          </View>
        </View>

        {/* Pedidos del cliente */}
        <Card className="rounded-[10px]">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Pedidos del cliente</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {pedidosDelCliente.length === 0 ? (
              <Text className="text-sm text-muted-foreground">Sin pedidos.</Text>
            ) : (
              pedidosDelCliente.map((p) => {
                const total = (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.total_linea, 0);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => router.push(`/pedidos/${p.id}`)}
                    className="active:opacity-80"
                  >
                    <View className="flex-row items-center justify-between rounded-md border border-border p-3">
                      <View className="gap-0.5">
                        <Text className="text-sm font-medium">Pedido nº {p.numero_pedido}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {ESTADOS_PEDIDO[p.estado].etiqueta}
                        </Text>
                      </View>
                      <Text className="text-sm font-semibold">{formatEUR(total)}</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </CardContent>
        </Card>

        {mensaje ? <Text className="text-sm text-muted-foreground">{mensaje}</Text> : null}
      </View>
    </ScrollView>
  );
}
