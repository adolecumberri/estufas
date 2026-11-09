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
import { Chip, ConfirmDialog } from '@/shared/ui';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Separator } from '@/shared/ui/separator';
import { Text } from '@/shared/ui/text';
import { usePermisos } from '@/shared/seguridad/use-permisos';
import { cacheBorrar, cacheEscribir, cacheLeer } from '@/shared/lib/cache';
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

// Datos cacheados por proveedor (FEEDBACK 10/11 §10): categorías + TODOS los
// productos del proveedor + las categorías de cada producto. `ts` viaja dentro
// del dato para poder calcular la edad desde AsyncStorage.
interface DatosProveedorCache {
  ts: number;
  categorias: CategoriaProveedor[];
  productos: ProductoProveedor[];
  categoriasPorProducto: Map<string, { id: string; nombre: string }[]>;
}

const TTL_MS = 5 * 60 * 1000; // caducada → se refresca en segundo plano
const TAM_PAGINA = 15; // render por lotes del listado (FEEDBACK §12)
const CLAVE_PREFIJO = 'estufas.cache.descuentos.proveedor.v1';
const CLAVE_PREFIJO_REGLAS = 'estufas.cache.descuentos.reglasProducto.v1';

const claveProveedor = (clienteId: string | null | undefined, proveedorId: string) =>
  `${CLAVE_PREFIJO}:${clienteId ?? 'anon'}:${proveedorId}`;
const claveReglas = (clienteId: string | null | undefined) =>
  `${CLAVE_PREFIJO_REGLAS}:${clienteId ?? 'anon'}`;

// Descuentos por proveedor (REQUISITOS_FICHA_CLIENTE §B.9 + FEEDBACK 10/11):
// una PESTAÑA por proveedor y, dentro, 3 PESTAÑAS (General · Categorías ·
// Productos). Los datos del proveedor se cachean en memoria + AsyncStorage
// (TTL): cambiar de pestaña repetidamente NO vuelve a llamar a BD (0 consultas
// tras la primera carga mientras la entrada esté fresca); si caducó se pinta
// la caché y se refresca en segundo plano (última petición gana). El buscador
// de productos filtra EN MEMORIA por referencia o nombre (0 llamadas por tecla)
// y el listado se pagina en el cliente. Cada producto muestra si YA tiene
// descuento y sus categorías (marcadas si esa categoría tiene regla para este
// proveedor).
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
  const [subpestana, setSubpestana] = React.useState<'general' | 'categorias' | 'productos'>(
    'general'
  );
  const [pctProveedor, setPctProveedor] = React.useState('');
  const [pctCategorias, setPctCategorias] = React.useState<Record<string, string>>({});
  const [mensaje, setMensaje] = React.useState<string | null>(null);
  const [anulando, setAnulando] = React.useState<AnularDescuento | null>(null);

  // Rama del proveedor activo (cacheada) y reglas de producto del cliente.
  const [datosProveedor, setDatosProveedor] = React.useState<DatosProveedorCache | null>(null);
  const [reglasProducto, setReglasProducto] = React.useState<Map<string, number>>(new Map());
  const [cargandoRama, setCargandoRama] = React.useState(false);
  const [errorRama, setErrorRama] = React.useState<string | null>(null);
  const [productoSeleccionado, setProductoSeleccionado] = React.useState<string | null>(null);
  const [pctProducto, setPctProducto] = React.useState('');

  // Búsqueda LOCAL de productos (referencia o nombre) y paginación en cliente:
  // ninguna tecla llama a BD (FEEDBACK §11-12).
  const [busqueda, setBusqueda] = React.useState('');
  const [visibles, setVisibles] = React.useState(TAM_PAGINA);

  // Caché en memoria (más rápida que AsyncStorage al cambiar de pestaña).
  const memoriaRef = React.useRef(new Map<string, DatosProveedorCache>());
  // Contador de peticiones de red: la última gana (debounce ante spam).
  const peticionesRef = React.useRef(0);

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

  // Reglas de producto del cliente (caché propia; se invalida tras guardar).
  const cargarReglasProducto = React.useCallback(async () => {
    if (!clienteId) return;
    const guardado = await cacheLeer<{ reglas: Record<string, number> }>(claveReglas(clienteId));
    if (guardado) {
      setReglasProducto(new Map(Object.entries(guardado.reglas)));
    }
    const hoy = new Date().toISOString().slice(0, 10);
    const vigencia = `fecha_fin.is.null,fecha_fin.gt.${hoy}`;
    const { data, error } = await supabase
      .from('descuentos_cliente_producto')
      .select('producto_id, descuento_porcentaje')
      .eq('cliente_id', clienteId)
      .eq('borrado', false)
      .lte('fecha_inicio', hoy)
      .or(vigencia);
    if (error) return;
    const mapa = new Map<string, number>();
    for (const f of (data ?? []) as { producto_id: string; descuento_porcentaje: number }[]) {
      mapa.set(f.producto_id, f.descuento_porcentaje);
    }
    setReglasProducto(mapa);
    void cacheEscribir(claveReglas(clienteId), { reglas: Object.fromEntries(mapa) });
  }, [clienteId]);

  React.useEffect(() => {
    void cargarReglasProducto();
  }, [cargarReglasProducto]);

  // Rama por proveedor con caché (memoria + AsyncStorage, TTL, última gana):
  // - entrada fresca → se pinta al instante SIN llamada de red;
  // - entrada caducada → se pinta la caché y se refresca en segundo plano;
  // - sin entrada → red.
  const cargarRamaProveedor = React.useCallback(
    async (pid: string) => {
      const clave = claveProveedor(clienteId, pid);
      const ahora = Date.now();
      const enMemoria = memoriaRef.current.get(clave);
      let cache: DatosProveedorCache | null = enMemoria ?? null;
      if (!cache) {
        cache = await cacheLeer<DatosProveedorCache>(clave);
        if (cache) memoriaRef.current.set(clave, cache);
      }

      if (cache) {
        setDatosProveedor(cache);
        setCargandoRama(false);
        setErrorRama(null);
        if (ahora - cache.ts < TTL_MS) return; // fresca: sin red
      } else {
        setCargandoRama(true);
      }

      // Caducada o inexistente → red (la última petición gana).
      const idPeticion = ++peticionesRef.current;
      setErrorRama(null);
      const [resCat, resProd] = await Promise.all([
        supabase.rpc('fn_categorias_proveedor', { p_proveedor: pid }),
        // Sin búsqueda: TODOS los productos del proveedor se cargan una vez y
        // el filtro del buscador es local (FEEDBACK §11).
        supabase.rpc('fn_productos_proveedor', {
          p_cliente: clienteId ?? null,
          p_proveedor: pid,
          p_busqueda: null,
          p_limite: 100,
        }),
      ]);
      if (idPeticion !== peticionesRef.current) return; // superada por otra pestaña

      const categorias = (resCat.data ?? []) as CategoriaProveedor[];
      const productos = (resProd.data ?? []) as ProductoProveedor[];

      // Categorías de cada producto (una consulta por proveedor, cacheada).
      let categoriasPorProducto = new Map<string, { id: string; nombre: string }[]>();
      if (productos.length > 0) {
        const ids = productos.map((p) => p.producto_id);
        const resPc = await supabase
          .from('producto_categoria')
          .select('producto_id, categoria_id, categoria:categorias(nombre)')
          .eq('borrado', false)
          .in('producto_id', ids);
        if (idPeticion !== peticionesRef.current) return;
        if (!resPc.error) {
          const porId = new Map<string, { id: string; nombre: string }[]>();
          for (const f of resPc.data as {
            producto_id: string;
            categoria_id: string;
            categoria: { nombre: string } | { nombre: string }[] | null;
          }[]) {
            const embed = f.categoria;
            const nombre = embed
              ? Array.isArray(embed)
                ? (embed[0]?.nombre ?? null)
                : embed.nombre
              : null;
            if (!nombre) continue;
            const lista = porId.get(f.producto_id) ?? [];
            lista.push({ id: f.categoria_id, nombre });
            porId.set(f.producto_id, lista);
          }
          categoriasPorProducto = porId;
        }
      }

      const datos: DatosProveedorCache = {
        ts: Date.now(),
        categorias,
        productos,
        categoriasPorProducto,
      };
      memoriaRef.current.set(clave, datos);
      void cacheEscribir(clave, datos);
      setDatosProveedor(datos);
      setCargandoRama(false);
      setErrorRama(resCat.error?.message ?? resProd.error?.message ?? null);
    },
    [clienteId]
  );

  // Debounce (150 ms) al cambiar de pestaña: el spam de clics solo dispara la
  // última carga; con caché fresca ni siquiera hay red.
  React.useEffect(() => {
    if (!proveedorActivo) return;
    setDatosProveedor(null); // evita pintar la rama del proveedor anterior
    const t = setTimeout(() => {
      void cargarRamaProveedor(proveedorActivo);
    }, 150);
    return () => clearTimeout(t);
  }, [proveedorActivo, cargarRamaProveedor]);

  // Categorías con regla de ESTE proveedor (para marcar las de cada producto).
  const idsCategoriaConRegla = React.useMemo(() => {
    if (!proveedorActivo) return new Set<string>();
    return new Set(
      reglasCategoria.filter((r) => r.proveedor_id === proveedorActivo).map((r) => r.categoria_id)
    );
  }, [reglasCategoria, proveedorActivo]);

  // Filtro LOCAL por referencia o nombre + paginación en cliente.
  const productosFiltrados = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = datosProveedor?.productos ?? [];
    if (!q) return base;
    return base.filter(
      (p) => p.nombre.toLowerCase().includes(q) || p.referencia.toLowerCase().includes(q)
    );
  }, [busqueda, datosProveedor]);

  React.useEffect(() => {
    setVisibles(TAM_PAGINA);
  }, [busqueda, proveedorActivo]);

  if (!puedeEditar) return null;

  const reglaProveedor = proveedorActivo
    ? proveedores.find((p) => p.proveedor_id === proveedorActivo)
    : undefined;

  const cambiarProveedor = (pid: string) => {
    setProveedorActivo(pid);
    setSubpestana('general');
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
      // Invalida la caché de reglas de producto y la refresca (FEEDBACK §10).
      void cacheBorrar(claveReglas(clienteId));
      void cargarReglasProducto();
    }
  };

  const confirmarAnular = async () => {
    if (!anulando) return;
    const { error } = await anular(anulando);
    setAnulando(null);
    setMensaje(error ?? 'Descuento anulado.');
    if (!error) {
      void cacheBorrar(claveReglas(clienteId));
      void cargarReglasProducto();
    }
  };

  const productoElegido = productosFiltrados.find((p) => p.producto_id === productoSeleccionado);

  return (
    <View className="gap-2">
      <SectionTitle>Descuentos por proveedor</SectionTitle>
      <Text className="text-xs text-muted-foreground">
        Una pestaña por proveedor con sus reglas; el descuento por producto sigue teniendo
        preferencia.
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
                {/* Pestañas internas del proveedor: General · Categorías · Productos */}
                <View className="flex-row flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'general', etiqueta: 'General' },
                      { id: 'categorias', etiqueta: 'Categorías' },
                      { id: 'productos', etiqueta: 'Productos' },
                    ] as const
                  ).map((t) => (
                    <Chip
                      key={t.id}
                      etiqueta={t.etiqueta}
                      activo={subpestana === t.id}
                      onPress={() => setSubpestana(t.id)}
                    />
                  ))}
                </View>

                {subpestana === 'general' ? (
                  <View className="gap-2">
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
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Label nativeID="pct-proveedor">%</Label>
                      <Input
                        nativeID="pct-proveedor"
                        keyboardType="decimal-pad"
                        value={pctProveedor}
                        onChangeText={setPctProveedor}
                        placeholder="0"
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
                  </View>
                ) : null}

                {subpestana === 'categorias' ? (
                  <View className="gap-1.5">
                    {cargandoRama && !datosProveedor ? (
                      <ActivityIndicator color={colores.primario} />
                    ) : !datosProveedor || datosProveedor.categorias.length === 0 ? (
                      <Text className="text-sm text-muted-foreground">
                        Sin categorías disponibles.
                      </Text>
                    ) : (
                      datosProveedor.categorias.map((c) => {
                        const regla = reglasCategoria.find(
                          (r) => r.proveedor_id === proveedorActivo && r.categoria_id === c.id
                        );
                        return (
                          <ListCard key={c.id}>
                            <View className="flex-row flex-wrap items-center justify-between gap-2">
                              <View className="flex-1 gap-0.5">
                                <Text className="text-sm font-medium" numberOfLines={1}>
                                  {c.nombre}
                                </Text>
                                <Text className="text-xs text-muted-foreground">
                                  {regla ? `Actual: ${formatPct(regla.pct)}` : 'Sin descuento'}
                                </Text>
                              </View>
                              <View className="flex-row flex-wrap items-center gap-1">
                                <Label nativeID={`pct-categoria-${c.id}`}>%</Label>
                                <Input
                                  nativeID={`pct-categoria-${c.id}`}
                                  keyboardType="decimal-pad"
                                  value={pctCategorias[c.id] ?? ''}
                                  onChangeText={(v) =>
                                    setPctCategorias((prev) => ({ ...prev, [c.id]: v }))
                                  }
                                  placeholder="0"
                                  className="h-9 w-16 text-sm"
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
                            </View>
                          </ListCard>
                        );
                      })
                    )}
                  </View>
                ) : null}

                {subpestana === 'productos' ? (
                  <View className="gap-2">
                    <View className="flex-row items-center gap-2">
                      <Search size={16} color={colores.tenue} />
                      <Input
                        value={busqueda}
                        onChangeText={setBusqueda}
                        placeholder="Buscar por referencia o nombre…"
                        className="h-10 flex-1 text-sm"
                      />
                    </View>
                    {cargandoRama && !datosProveedor ? (
                      <ActivityIndicator color={colores.primario} />
                    ) : productosFiltrados.length === 0 ? (
                      <Text className="text-sm text-muted-foreground">Sin productos.</Text>
                    ) : (
                      <>
                        {productosFiltrados.slice(0, visibles).map((p) => {
                          const seleccionado = productoSeleccionado === p.producto_id;
                          const pctRegla = reglasProducto.get(p.producto_id);
                          const categoriasProducto =
                            datosProveedor?.categoriasPorProducto.get(p.producto_id) ?? [];
                          return (
                            <ListCard
                              key={p.producto_id}
                              onPress={() => setProductoSeleccionado(p.producto_id)}
                              className={seleccionado ? 'border-primary bg-primary/5' : ''}
                            >
                              <View className="flex-row items-start justify-between gap-2">
                                <View className="flex-1 gap-0.5">
                                  <Text className="text-sm font-medium" numberOfLines={1}>
                                    {p.nombre}
                                  </Text>
                                  <FilaDetalle
                                    etiqueta={`Ref. ${p.referencia} · ${formatEUR(p.precio_base)}`}
                                    valor={formatEUR(p.precio_final)}
                                  />
                                </View>
                                {pctRegla !== undefined ? (
                                  <View className="rounded-full bg-primary/10 px-2 py-0.5">
                                    <Text className="text-xs font-bold text-primary">
                                      {pctRegla === 0
                                        ? '0% EXCLUIDO'
                                        : `-${formatPct(pctRegla)} DTO`}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              {categoriasProducto.length > 0 ? (
                                <View className="flex-row flex-wrap gap-1">
                                  {categoriasProducto.map((c) => {
                                    const conDescuento = idsCategoriaConRegla.has(c.id);
                                    return (
                                      <View
                                        key={c.id}
                                        className={
                                          conDescuento
                                            ? 'rounded-full bg-primary/10 px-2 py-0.5'
                                            : 'rounded-full bg-muted px-2 py-0.5'
                                        }
                                      >
                                        <Text
                                          className={
                                            conDescuento
                                              ? 'text-[10px] font-medium text-primary'
                                              : 'text-[10px] text-muted-foreground'
                                          }
                                        >
                                          {c.nombre}
                                        </Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              ) : null}
                            </ListCard>
                          );
                        })}
                        {productosFiltrados.length > visibles ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="self-start"
                            onPress={() => setVisibles((v) => v + TAM_PAGINA)}
                          >
                            <Text className="text-xs">
                              Mostrar más ({productosFiltrados.length - visibles} restantes)
                            </Text>
                          </Button>
                        ) : null}
                      </>
                    )}

                    {productoSeleccionado ? (
                      <View className="gap-2">
                        <Separator />
                        <Text className="text-xs text-muted-foreground">
                          Producto seleccionado: {productoElegido?.nombre ?? productoSeleccionado}
                        </Text>
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Label nativeID="pct-producto">%</Label>
                          <Input
                            nativeID="pct-producto"
                            keyboardType="decimal-pad"
                            value={pctProducto}
                            onChangeText={setPctProducto}
                            placeholder="0"
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
                      </View>
                    ) : null}
                  </View>
                ) : null}
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
