import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck, Flame, Mail, Percent, ShieldCheck, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { EmptyState, ErrorView, LoadingView } from '@/shared/componentes/estados';
import { FilaDetalle, ListCard } from '@/shared/componentes/list-card';
import { ScreenScroll } from '@/shared/componentes/screen';
import { ScreenHeader } from '@/shared/componentes/screen-header';
import { SectionTitle } from '@/shared/componentes/section-title';
import { FormField } from '@/shared/ui';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Text } from '@/shared/ui/text';
import { COMBUSTIBLES, ESTADOS_PEDIDO, TIPOS_CLIENTE } from '@/shared/constantes';
import type { CombustibleId } from '@/shared/constantes';
import { useSolicitud } from '@/features/carrito/contexto';
import { DescuentosProveedor } from '@/features/cartera/componentes/descuentos-proveedor';
import { usePermisos } from '@/shared/seguridad/use-permisos';
import { useCatalogo } from '@/features/catalogo/hooks/use-catalogo';
import { useCliente, useDescuentos } from '@/features/cartera/hooks/use-comercial';
import { usePedidos } from '@/features/pedidos/hooks/use-pedidos';
import { formatEUR, formatFecha, formatPct } from '@/shared/lib/format';
import { useColoresIcono } from '@/shared/lib/theme';

const DESCRIPCIONES_COMBUSTIBLE: Record<CombustibleId, string> = {
  pellets: 'Canalizadas, Aire y Autónomas',
  lena: 'Fundición, Cassette e Insert',
};

export default function ClienteDetalle() {
  const { id, desde } = useLocalSearchParams<{ id: string; desde?: string }>();
  const { setClienteObjetivoId } = useSolicitud();
  // Comercial Y admin pueden abrir una solicitud para este cliente; el resto
  // del alcance lo valida el backend (RLS/RPC, anillo 1).
  const { puede } = usePermisos();
  const puedeGestionar = puede('pedidos:crear_para_cliente');
  const { cliente, descuentos, descuentosCombustible, cargando, error, recargar } = useCliente(id);
  const { asignarGeneral, anularProducto, asignarCombustible, anularCombustible } = useDescuentos();
  const { pedidos } = usePedidos();
  const catalogo = useCatalogo(id);
  const colores = useColoresIcono();

  const [pctGeneral, setPctGeneral] = React.useState('');
  const [pctCombustibles, setPctCombustibles] = React.useState<{ pellets: string; lena: string }>({
    pellets: '',
    lena: '',
  });
  const [mensaje, setMensaje] = React.useState<string | null>(null);

  // Pre-rellena el valor del descuento general con el vigente al cargar
  // (y tras guardar, cuando recargar() refresca el cliente).
  React.useEffect(() => {
    if (cliente && cliente.descuento_porcentaje > 0) {
      setPctGeneral(String(cliente.descuento_porcentaje));
    }
  }, [cliente]);

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
    // Fija el cliente objetivo (cubo del borrador) y abre la solicitud:
    // funciona igual para comercial y admin (creado_por lo registra el RPC).
    setClienteObjetivoId(id ?? null);
    router.replace('/solicitud');
  };

  const nombreCliente = cliente
    ? (cliente.razon_social ?? `${cliente.nombre} ${cliente.apellidos ?? ''}`.trim())
    : 'Cliente';

  return (
    <ScreenScroll>
      <ScreenHeader
        titulo={nombreCliente}
        subtitulo={
          cliente
            ? `${cliente.email}${cliente.tipo_cliente ? ` · ${TIPOS_CLIENTE[cliente.tipo_cliente].etiqueta}` : ''}`
            : ''
        }
        respaldo={desde ?? '/cartera'}
      />

      {cargando ? (
        <LoadingView />
      ) : error ? (
        <ErrorView mensaje={error} onReintentar={() => void recargar()} />
      ) : !cliente ? (
        <EmptyState titulo="Cliente no encontrado" />
      ) : (
        <>
          {/* CTA principal: abrirle un pedido (REQUISITOS_FICHA_CLIENTE §B.7) */}
          {puedeGestionar ? (
            <Button onPress={empezarPedido} className="w-full">
              <Text>Crear pedido para este cliente</Text>
            </Button>
          ) : null}

          {/* Datos del cliente (sin repetir el nombre: ya está en la cabecera) */}
          <Card className="rounded-lg">
            <CardContent className="gap-1.5">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1 gap-0.5">
                  {cliente.nif_cif ? (
                    <Text className="text-sm text-muted-foreground">CIF {cliente.nif_cif}</Text>
                  ) : null}
                  <View className="flex-row items-center gap-1.5">
                    <Mail size={14} color={colores.tenue} />
                    <Text className="text-sm text-muted-foreground">{cliente.email}</Text>
                  </View>
                  {cliente.telefono ? <Text className="text-sm">{cliente.telefono}</Text> : null}
                </View>
                <View className="flex-row items-center gap-1">
                  <CircleCheck
                    size={14}
                    color={cliente.activo ? colores.primario : colores.tenue}
                  />
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
            </CardContent>
          </Card>

          {/* Descuento general de cartera (valor numérico libre, sin chips) */}
          <Card className="rounded-lg">
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
                    <Text className="text-xs text-muted-foreground">
                      Base para todos los pedidos
                    </Text>
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
                <FormField etiqueta="Valor Porcentual">
                  <Input
                    keyboardType="decimal-pad"
                    value={pctGeneral}
                    onChangeText={setPctGeneral}
                    placeholder="%"
                    className="h-10 w-24 text-sm"
                  />
                </FormField>
                <View className="flex-row items-center gap-3">
                  <Button size="sm" variant="secondary" onPress={() => void guardarGeneral()}>
                    <Text>Aplicar</Text>
                  </Button>
                  <Text className="text-xs text-muted-foreground">
                    Actual: {formatPct(cliente.descuento_porcentaje)}
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>

          {/* Descuentos por proveedor (pestañas con categorías y productos de
              cada proveedor + historial; solo si el rol puede gestionarlos) */}
          <DescuentosProveedor clienteId={id} />

          {/* Por categoría técnica (descuento por combustible) */}
          <View className="gap-2">
            <SectionTitle
              accion={
                <Text className="text-xs text-muted-foreground">
                  {descuentosCombustible.length} reglas activas en catálogo
                </Text>
              }
            >
              Por Categoría Técnica
            </SectionTitle>
            {COMBUSTIBLES.map((c) => {
              const descuento = descuentosCombustible.find((d) => d.combustible === c.id);
              return (
                <Card key={c.id} className="rounded-lg">
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
                    <FormField etiqueta="Porcentaje">
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
                    </FormField>
                  </CardContent>
                </Card>
              );
            })}
          </View>

          {/* Descuentos por producto (lista de reglas existentes; el alta por
              artículo vive en la pestaña del proveedor correspondiente) */}
          <View className="gap-2">
            <SectionTitle>Descuentos por Producto</SectionTitle>
            <Text className="text-xs text-muted-foreground">
              {descuentos.length} referencias con tarifa individualizada
            </Text>

            {descuentos.length === 0 ? (
              <Text className="text-sm text-muted-foreground">Sin descuentos específicos.</Text>
            ) : (
              descuentos.map((d) => {
                const producto = catalogo.productos.find((p) => p.producto_id === d.producto_id);
                return (
                  <ListCard key={d.id}>
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1 gap-0.5">
                        <Text className="text-xs text-muted-foreground">
                          Ref. {producto?.referencia ?? d.producto_id}
                        </Text>
                        <Text className="text-sm font-semibold" numberOfLines={1}>
                          {producto?.nombre ?? d.producto_id}
                        </Text>
                        {producto ? (
                          <FilaDetalle
                            etiqueta="Precio"
                            valor={
                              <View className="flex-row items-baseline gap-2">
                                <Text className="text-xs text-muted-foreground line-through">
                                  {formatEUR(producto.precio_base)}
                                </Text>
                                <Text className="text-sm font-bold text-primary">
                                  {formatEUR(producto.precio_final)}
                                </Text>
                              </View>
                            }
                          />
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
                          accessibilityLabel={`Anular descuento del producto ${producto?.nombre ?? d.producto_id}`}
                          onPress={() => void anularDescuentoProducto(d.producto_id)}
                        >
                          <Trash2 size={16} color={colores.destructivo} />
                        </Button>
                      </View>
                    </View>
                  </ListCard>
                );
              })
            )}
          </View>

          {/* Nota de auditoría */}
          <View className="flex-row items-start gap-2 rounded-xl bg-muted p-3">
            <ShieldCheck size={18} color={colores.primario} className="mt-0.5 shrink-0" />
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-semibold">
                Condiciones vinculadas a{' '}
                {cliente.nif_cif ? `CIF ${cliente.nif_cif}` : 'esta cuenta'}
              </Text>
              <Text className="text-xs text-muted-foreground">
                Las modificaciones quedan registradas en el historial de auditoría comercial de la
                cuenta y entran en vigor de forma inmediata en las cotizaciones vigentes.
              </Text>
            </View>
          </View>

          {/* Pedidos del cliente */}
          <View className="gap-2">
            <SectionTitle>Pedidos del cliente</SectionTitle>
            {pedidosDelCliente.length === 0 ? (
              <Text className="text-sm text-muted-foreground">Sin pedidos.</Text>
            ) : (
              pedidosDelCliente.map((p) => {
                const total = (p.pedido_lineas ?? []).reduce((acc, l) => acc + l.total_linea, 0);
                return (
                  <ListCard key={p.id} onPress={() => router.push(`/pedidos/${p.id}`)}>
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-medium">Pedido nº {p.numero_pedido}</Text>
                        <Badge variant="outline">
                          <Text>{ESTADOS_PEDIDO[p.estado].etiqueta}</Text>
                        </Badge>
                      </View>
                      <Text className="text-sm font-semibold">{formatEUR(total)}</Text>
                    </View>
                    <FilaDetalle etiqueta="Fecha" valor={formatFecha(p.fecha_pedido)} />
                  </ListCard>
                );
              })
            )}
          </View>

          {mensaje ? <Text className="text-sm text-muted-foreground">{mensaje}</Text> : null}
        </>
      )}
    </ScreenScroll>
  );
}
