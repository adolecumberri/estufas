import { Search, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  useDescuentosCliente,
  type AnularDescuento,
  type FilaHistorialDescuento,
} from '@/features/cartera/hooks/use-descuentos';
import { useProveedoresComercial } from '@/features/cartera/hooks/use-comercial';
import { EmptyState, ErrorView, LoadingView } from '@/shared/componentes/estados';
import { FilaDetalle, ListCard } from '@/shared/componentes/list-card';
import { SectionTitle } from '@/shared/componentes/section-title';
import { Chip, ConfirmDialog, FormField } from '@/shared/ui';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Separator } from '@/shared/ui/separator';
import { Text } from '@/shared/ui/text';
import { usePermisos } from '@/shared/seguridad/use-permisos';
import { formatEUR, formatFechaHora, formatPct } from '@/shared/lib/format';
import { supabase } from '@/shared/lib/supabase';
import { useColoresIcono } from '@/shared/lib/theme';

const ACCIONES: Record<FilaHistorialDescuento['accion'], string> = {
  crear: 'creado',
  actualizar: 'actualizado',
  anular: 'anulado',
};

const etiquetaNivel = (h: FilaHistorialDescuento) => {
  const base =
    h.nivel === 'general'
      ? 'General'
      : h.nivel === 'proveedor'
        ? 'Proveedor'
        : h.nivel === 'categoria'
          ? 'Categoría'
          : 'Producto';
  const objetivo = h.proveedor?.nombre ?? h.categoria?.nombre ?? h.producto?.nombre;
  return objetivo ? `${base} · ${objetivo}` : base;
};

// "0-100" con coma decimal, como el resto de inputs de la pantalla.
const parsePct = (valor: string): number | null => {
  const texto = valor.trim().replace(',', '.');
  if (texto === '') return null;
  const pct = Number(texto);
  if (Number.isNaN(pct) || pct < 0 || pct > 100) return null;
  return pct;
};

// Filas de los RPC 0027 (SECURITY DEFINER, con alcance por proveedor/cliente).
interface CategoriaProveedor {
  id: string;
  nombre: string;
  clave: string;
  grupo: string;
  orden: number;
}

interface ProductoProveedor {
  producto_id: string;
  referencia: string;
  nombre: string;
  precio_base: number;
  precio_final: number;
}

const DEBOUNCE_MS = 300;

// Descuentos por proveedor (REQUISITOS_FICHA_CLIENTE §B.9): una PESTAÑA por
// proveedor; cada pestaña trae su propia rama — descuento del proveedor,
// categorías derivadas de SUS productos (producto_categoria ⋈ productos por
// proveedor_id) y productos DE ESE proveedor para el descuento por artículo.
// Al cambiar de pestaña cambian categorías y productos (RPC 0027). Incluye el
// historial de cambios (últimas 30). Solo se muestra si el rol puede
// gestionar descuentos (comercial).
export function DescuentosProveedor({ clienteId }: { clienteId: string | null | undefined }) {
  const { puede } = usePermisos();
  const puedeEditar = puede('descuentos:gestionar');
  const { proveedores: proveedoresVisibles, cargando: cargandoProveedores } =
    useProveedoresComercial();
  const {
    proveedores,
    categorias: reglasCategoria,
    historial,
    cargando,
    error,
    recargar,
    guardarProveedor,
    guardarCategoria,
    guardarProducto,
    anular,
  } = useDescuentosCliente(clienteId);
  const colores = useColoresIcono();

  const [proveedorActivo, setProveedorActivo] = React.useState<string | null>(null);
  const [pctProveedor, setPctProveedor] = React.useState('');
  const [pctCategorias, setPctCategorias] = React.useState<Record<string, string>>({});
  const [mensaje, setMensaje] = React.useState<string | null>(null);
  const [anulando, setAnulando] = React.useState<AnularDescuento | null>(null);

  // Rama del proveedor activo (categorías y productos de ESE proveedor).
  const [busqueda, setBusqueda] = React.useState('');
  const [categoriasProveedor, setCategoriasProveedor] = React.useState<CategoriaProveedor[]>([]);
  const [productosProveedor, setProductosProveedor] = React.useState<ProductoProveedor[]>([]);
  const [cargandoRama, setCargandoRama] = React.useState(false);
  const [errorRama, setErrorRama] = React.useState<string | null>(null);
  const [productoSeleccionado, setProductoSeleccionado] = React.useState<string | null>(null);
  const [pctProducto, setPctProducto] = React.useState('');

  // Selecciona el primer proveedor disponible al cargar la lista.
  React.useEffect(() => {
    if (!proveedorActivo && proveedoresVisibles.length > 0) {
      setProveedorActivo(proveedoresVisibles[0].id);
    }
  }, [proveedorActivo, proveedoresVisibles]);

  // Al cambiar de proveedor, precarga su % vigente (si tiene regla).
  React.useEffect(() => {
    const regla = proveedorActivo
      ? proveedores.find((p) => p.proveedor_id === proveedorActivo)
      : undefined;
    setPctProveedor(regla ? String(regla.pct) : '');
  }, [proveedorActivo, proveedores]);

  // Rama por pestaña: categorías y productos del proveedor activo (con
  // debounce en la búsqueda de productos).
  React.useEffect(() => {
    if (!proveedorActivo) return;
    let cancelado = false;
    setCargandoRama(true);
    setErrorRama(null);
    const t = setTimeout(() => {
      void (async () => {
        const [resCat, resProd] = await Promise.all([
          supabase.rpc('fn_categorias_proveedor', { p_proveedor: proveedorActivo }),
          supabase.rpc('fn_productos_proveedor', {
            p_cliente: clienteId ?? null,
            p_proveedor: proveedorActivo,
            p_busqueda: busqueda.trim() || null,
            p_limite: 40,
          }),
        ]);
        if (cancelado) return;
        setCategoriasProveedor((resCat.data ?? []) as CategoriaProveedor[]);
        setProductosProveedor((resProd.data ?? []) as ProductoProveedor[]);
        setErrorRama(resCat.error?.message ?? resProd.error?.message ?? null);
        setCargandoRama(false);
      })();
    }, DEBOUNCE_MS);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [proveedorActivo, busqueda, clienteId]);

  if (!puedeEditar) return null;

  const reglaProveedor = proveedorActivo
    ? proveedores.find((p) => p.proveedor_id === proveedorActivo)
    : undefined;

  const cambiarProveedor = (pid: string) => {
    setProveedorActivo(pid);
    setProductoSeleccionado(null);
    setPctProducto('');
    setBusqueda('');
  };

  const guardarProveedorPct = async () => {
    if (!proveedorActivo) return;
    const pct = parsePct(pctProveedor);
    if (pct === null) {
      setMensaje('Porcentaje inválido (0-100).');
      return;
    }
    const { error } = await guardarProveedor(proveedorActivo, pct);
    setMensaje(error ?? 'Descuento de proveedor guardado.');
  };

  const guardarCategoriaPct = async (categoriaId: string) => {
    if (!proveedorActivo) return;
    const pct = parsePct(pctCategorias[categoriaId] ?? '');
    if (pct === null) {
      setMensaje('Porcentaje inválido (0-100).');
      return;
    }
    const { error } = await guardarCategoria(proveedorActivo, categoriaId, pct);
    setMensaje(error ?? 'Descuento de categoría guardado.');
  };

  const guardarProductoPct = async () => {
    if (!productoSeleccionado) return;
    const pct = parsePct(pctProducto);
    if (pct === null) {
      setMensaje('Porcentaje inválido (0-100).');
      return;
    }
    const { error } = await guardarProducto(productoSeleccionado, pct);
    setMensaje(error ?? 'Descuento de producto guardado.');
    if (!error) {
      setProductoSeleccionado(null);
      setPctProducto('');
    }
  };

  const confirmarAnular = async () => {
    if (!anulando) return;
    const { error } = await anular(anulando);
    setAnulando(null);
    setMensaje(error ?? 'Descuento anulado.');
  };

  const productoElegido = productosProveedor.find((p) => p.producto_id === productoSeleccionado);

  return (
    <View className="gap-2">
      <SectionTitle>Descuentos por proveedor</SectionTitle>
      <Text className="text-xs text-muted-foreground">
        Una pestaña por proveedor con sus categorías y productos; el descuento por producto sigue
        teniendo preferencia.
      </Text>

      {cargando || cargandoProveedores ? (
        <LoadingView />
      ) : error ? (
        <ErrorView mensaje={error} onReintentar={() => void recargar()} />
      ) : proveedoresVisibles.length === 0 ? (
        <EmptyState titulo="Sin proveedores habilitados" />
      ) : (
        <View className="gap-2">
          {/* Pestañas por proveedor */}
          <View className="flex-row flex-wrap gap-1.5">
            {proveedoresVisibles.map((p) => (
              <Chip
                key={p.id}
                etiqueta={p.nombre}
                activo={proveedorActivo === p.id}
                onPress={() => cambiarProveedor(p.id)}
              />
            ))}
          </View>

          {proveedorActivo ? (
            <Card className="rounded-lg">
              <CardContent className="gap-3">
                {/* Descuento del proveedor */}
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-sm font-semibold">Descuento del proveedor</Text>
                  {reglaProveedor ? (
                    <View className="rounded-md bg-primary/10 px-2 py-1">
                      <Text className="text-xs font-semibold text-primary">
                        {formatPct(reglaProveedor.pct)} Dto.
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
                      value={pctProveedor}
                      onChangeText={setPctProveedor}
                      placeholder="%"
                      className="h-10 w-24 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => void guardarProveedorPct()}
                    >
                      <Text>Guardar</Text>
                    </Button>
                    {reglaProveedor ? (
                      <Button
                        size="sm"
                        variant="outline"
                        accessibilityLabel="Anular descuento del proveedor"
                        onPress={() =>
                          setAnulando({ nivel: 'proveedor', proveedorId: proveedorActivo })
                        }
                      >
                        <Text className="text-xs">Anular</Text>
                      </Button>
                    ) : null}
                  </View>
                </FormField>

                {/* Categorías de ESTE proveedor (derivadas de sus productos) */}
                <View className="gap-1.5">
                  <SectionTitle>Categorías del proveedor</SectionTitle>
                  {cargandoRama ? (
                    <ActivityIndicator color={colores.primario} />
                  ) : categoriasProveedor.length === 0 ? (
                    <Text className="text-sm text-muted-foreground">
                      Sin categorías disponibles.
                    </Text>
                  ) : (
                    categoriasProveedor.map((c) => {
                      const regla = reglasCategoria.find(
                        (r) => r.proveedor_id === proveedorActivo && r.categoria_id === c.id
                      );
                      return (
                        <ListCard key={c.id}>
                          <View className="flex-row items-center justify-between gap-2">
                            <View className="flex-1 gap-0.5">
                              <Text className="text-sm font-medium" numberOfLines={1}>
                                {c.nombre}
                              </Text>
                              <Text className="text-xs text-muted-foreground">
                                {regla ? `Actual: ${formatPct(regla.pct)}` : 'Sin descuento'}
                              </Text>
                            </View>
                            <Input
                              keyboardType="decimal-pad"
                              value={pctCategorias[c.id] ?? ''}
                              onChangeText={(v) =>
                                setPctCategorias((prev) => ({ ...prev, [c.id]: v }))
                              }
                              placeholder="%"
                              className="h-9 w-20 text-sm"
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => void guardarCategoriaPct(c.id)}
                            >
                              <Text>Guardar</Text>
                            </Button>
                            {regla ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                accessibilityLabel={`Anular descuento de categoría ${c.nombre}`}
                                onPress={() =>
                                  setAnulando({
                                    nivel: 'categoria',
                                    proveedorId: proveedorActivo,
                                    categoriaId: c.id,
                                  })
                                }
                              >
                                <Trash2 size={16} color={colores.destructivo} />
                              </Button>
                            ) : null}
                          </View>
                        </ListCard>
                      );
                    })
                  )}
                </View>

                {/* Productos de ESTE proveedor (buscador filtrado) */}
                <View className="gap-1.5">
                  <SectionTitle>Productos de este proveedor</SectionTitle>
                  <View className="flex-row items-center gap-2">
                    <Search size={16} color={colores.tenue} />
                    <Input
                      value={busqueda}
                      onChangeText={setBusqueda}
                      placeholder="Buscar por referencia o modelo…"
                      className="h-10 flex-1 text-sm"
                    />
                  </View>
                  {cargandoRama ? (
                    <ActivityIndicator color={colores.primario} />
                  ) : productosProveedor.length === 0 ? (
                    <Text className="text-sm text-muted-foreground">Sin productos.</Text>
                  ) : (
                    <View className="gap-1.5">
                      {productosProveedor.map((p) => {
                        const seleccionado = productoSeleccionado === p.producto_id;
                        return (
                          <ListCard
                            key={p.producto_id}
                            onPress={() => setProductoSeleccionado(p.producto_id)}
                            className={seleccionado ? 'border-primary bg-primary/5' : ''}
                          >
                            <Text className="text-sm font-medium" numberOfLines={1}>
                              {p.nombre}
                            </Text>
                            <FilaDetalle
                              etiqueta={`Ref. ${p.referencia} · ${formatEUR(p.precio_base)}`}
                              valor={formatEUR(p.precio_final)}
                            />
                          </ListCard>
                        );
                      })}
                    </View>
                  )}
                  {productoSeleccionado ? (
                    <View className="gap-2">
                      <Separator />
                      <Text className="text-xs text-muted-foreground">
                        Producto seleccionado: {productoElegido?.nombre ?? productoSeleccionado}
                      </Text>
                      <FormField etiqueta="Porcentaje">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Input
                            keyboardType="decimal-pad"
                            value={pctProducto}
                            onChangeText={setPctProducto}
                            placeholder="%"
                            className="h-10 w-24 text-sm"
                          />
                          <Button size="sm" onPress={() => void guardarProductoPct()}>
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
                      </FormField>
                    </View>
                  ) : null}
                </View>
              </CardContent>
            </Card>
          ) : null}
        </View>
      )}

      {errorRama ? <Text className="text-xs text-destructive">{errorRama}</Text> : null}
      {mensaje ? <Text className="text-sm text-muted-foreground">{mensaje}</Text> : null}

      {/* Historial de cambios */}
      <View className="gap-1.5 pt-2">
        <SectionTitle>Historial de cambios</SectionTitle>
        {historial.length === 0 ? (
          <EmptyState titulo="Sin cambios registrados" />
        ) : (
          historial.map((h) => (
            <ListCard key={h.id}>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm font-medium" numberOfLines={1}>
                  {etiquetaNivel(h)}
                </Text>
                <Text className="text-xs text-muted-foreground">{ACCIONES[h.accion]}</Text>
              </View>
              <FilaDetalle
                etiqueta="Descuento"
                valor={h.descuento_porcentaje != null ? formatPct(h.descuento_porcentaje) : '—'}
              />
              <FilaDetalle
                etiqueta="Actor"
                valor={h.actor_rol === 'admin' ? 'Admin' : 'Comercial'}
              />
              <FilaDetalle etiqueta="Fecha" valor={formatFechaHora(h.created_at)} />
            </ListCard>
          ))
        )}
      </View>

      <ConfirmDialog
        visible={anulando !== null}
        titulo="Anular descuento"
        mensaje="¿Seguro que quieres anular esta regla? El cambio queda registrado en el historial de cambios."
        destructivo
        onConfirmar={() => void confirmarAnular()}
        onCancelar={() => setAnulando(null)}
      />
    </View>
  );
}
