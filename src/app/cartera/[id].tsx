import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
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
  const [mensaje, setMensaje] = React.useState<string | null>(null);

  if (!session) return <Redirect href="/acceso" />;

  const puedeGestionar = perfil?.rol === 'comercial' || perfil?.rol === 'admin';
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
        <ActivityIndicator color="hsl(24.6 95% 53.1%)" />
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ paddingTop: insets.top + 8 }} className="gap-4 p-4">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={() => router.back()} className="rounded-md p-1 active:bg-accent">
            <ChevronLeft size={24} color={colores.primerPlano} />
          </Pressable>
          <Text className="text-xl font-bold tracking-tight">
            {cliente.razon_social ?? `${cliente.nombre} ${cliente.apellidos ?? ''}`.trim()}
          </Text>
          <Badge variant="outline" className="ml-auto">
            <Text>{cliente.tipo_cliente ? TIPOS_CLIENTE[cliente.tipo_cliente].etiqueta : ''}</Text>
          </Badge>
        </View>

        <Button onPress={empezarPedido}>
          <Text>Crear pedido para este cliente</Text>
        </Button>

        {/* Datos */}
        <Card>
          <CardContent className="gap-1">
            <Text className="text-sm">{cliente.email}</Text>
            {cliente.telefono && <Text className="text-sm">{cliente.telefono}</Text>}
            {cliente.nif_cif && (
              <Text className="text-sm text-muted-foreground">{cliente.nif_cif}</Text>
            )}
          </CardContent>
        </Card>

        {/* Descuento general */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descuento general</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            <Text className="text-sm text-muted-foreground">
              Actual: {formatPct(cliente.descuento_porcentaje)}
            </Text>
            <View className="flex-row items-center gap-2">
              <Input
                keyboardType="decimal-pad"
                value={pctGeneral}
                onChangeText={setPctGeneral}
                placeholder="%"
                className="h-10 w-24 text-sm"
              />
              <Button size="sm" variant="secondary" onPress={() => void guardarGeneral()}>
                <Text>Guardar</Text>
              </Button>
            </View>
          </CardContent>
        </Card>

        {/* Descuentos específicos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descuentos por producto</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            {descuentos.length === 0 && (
              <Text className="text-sm text-muted-foreground">Sin descuentos específicos.</Text>
            )}
            {descuentos.map((d) => {
              const producto = catalogo.productos.find((p) => p.producto_id === d.producto_id);
              return (
                <View key={d.id} className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-sm">{producto?.nombre ?? d.producto_id}</Text>
                  <Text className="text-sm font-medium">{formatPct(d.descuento_porcentaje)}</Text>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() =>
                      void (async () => {
                        const { error } = await anularProducto(id!, d.producto_id);
                        setMensaje(error ?? 'Descuento anulado.');
                        if (!error) await recargar();
                      })()
                    }
                  >
                    <Text className="text-xs">Anular</Text>
                  </Button>
                </View>
              );
            })}
            <Separator />
            <Text className="text-xs text-muted-foreground">
              Nuevo descuento (sustituye al general para ese producto; 0% = excluirlo):
            </Text>
            <Input
              value={catalogo.busqueda}
              onChangeText={catalogo.setBusqueda}
              placeholder="Buscar producto…"
              className="h-10 text-sm"
            />
            <ScrollView horizontal showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} className="max-h-16">
              <View className="flex-row gap-2">
                {catalogo.productos.map((p) => (
                  <Pressable
                    key={p.producto_id}
                    onPress={() => setProductoSeleccionado(p.producto_id)}
                    className={
                      productoSeleccionado === p.producto_id
                        ? 'rounded-full border border-primary bg-primary px-3 py-1.5'
                        : 'rounded-full border border-border px-3 py-1.5'
                    }
                  >
                    <Text
                      className={
                        productoSeleccionado === p.producto_id
                          ? 'text-xs text-primary-foreground'
                          : 'text-xs'
                      }
                    >
                      {p.nombre}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            {productoSeleccionado && (
              <View className="flex-row items-center gap-2">
                <Input
                  keyboardType="decimal-pad"
                  value={pctProducto}
                  onChangeText={setPctProducto}
                  placeholder="%"
                  className="h-10 w-24 text-sm"
                />
                <Button size="sm" variant="secondary" onPress={() => void guardarProducto()}>
                  <Text>Guardar</Text>
                </Button>
              </View>
            )}
          </CardContent>
        </Card>

        {/* Descuento por combustible */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descuento por combustible</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            <Text className="text-xs text-muted-foreground">
              El descuento por combustible aplica a todos los productos de esa sección (Pellets o
              Leña); el específico de producto y la promoción siguen teniendo preferencia.
            </Text>
            {COMBUSTIBLES.map((c) => {
              const descuento = descuentosCombustible.find((d) => d.combustible === c.id);
              return (
                <View key={c.id} className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium">{c.etiqueta}</Text>
                    <Text className="text-sm text-muted-foreground">
                      {descuento ? formatPct(descuento.descuento_porcentaje) : 'Sin descuento'}
                    </Text>
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
                    {descuento && (
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => void anularCombustibleDescuento(c.id)}
                      >
                        <Text className="text-xs">Anular</Text>
                      </Button>
                    )}
                  </View>
                </View>
              );
            })}
          </CardContent>
        </Card>

        {/* Pedidos del cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos del cliente</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {pedidosDelCliente.length === 0 ? (
              <Text className="text-sm text-muted-foreground">Sin pedidos.</Text>
            ) : (
              pedidosDelCliente.map((p) => {
                const total = (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.total_linea, 0);
                return (
                  <Pressable key={p.id} onPress={() => router.push(`/pedidos/${p.id}`)} className="active:opacity-80">
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

        {mensaje && <Text className="text-sm text-muted-foreground">{mensaje}</Text>}
      </View>
    </ScrollView>
  );
}
