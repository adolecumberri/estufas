import { RefreshCw } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Buscador } from '@/components/catalogo/buscador';
import { ChipsCategorias } from '@/components/catalogo/chips-categorias';
import { EncabezadoCatalogo } from '@/components/catalogo/encabezado';
import { TarjetaProducto } from '@/components/catalogo/tarjeta-producto';
import { NavInferior } from '@/components/navegacion/nav-inferior';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { COMBUSTIBLES } from '@/constants';
import { useSolicitud } from '@/contexts/solicitud-context';
import { useCatalogo } from '@/hooks/use-catalogo';
import { cn } from '@/lib/utils';

// Pantalla raíz de la app: catálogo público. Vive como componente compartido
// para ser la ruta inicial (/) sin depender de un Redirect (que provoca el
// aviso "GO_BACK was not handled" en Android). Compone los componentes
// compartidos del catálogo (diseño Stitch): cabecera fija, selector de
// combustible, buscador, chips de categorías, rejilla de 2 columnas con
// paginación y barra de navegación.
export default function CatalogoScreen() {
  const insets = useSafeAreaInsets();
  const { clienteObjetivoId } = useSolicitud();
  const cat = useCatalogo(clienteObjetivoId);

  // Chips del combustible activo, sin las categorías "comodín" pellet/leña.
  const categoriasFiltradas = cat.categorias.filter(
    (c) => c.combustible === cat.combustible && c.clave !== 'pellet' && c.clave !== 'lena'
  );

  // Etiqueta a la que se vuelve desde el detalle: categoría seleccionada o,
  // si no la hay, el combustible activo. Con búsqueda activa los resultados
  // cruzan combustibles, así que se usa una etiqueta neutra.
  const categoriaActiva = cat.categorias.find((c) => c.id === cat.categoria);
  const buscando = cat.busqueda.trim().length > 0;
  const origen =
    categoriaActiva?.nombre ??
    (buscando
      ? 'Catálogo'
      : (COMBUSTIBLES.find((c) => c.id === cat.combustible)?.etiqueta ?? 'Catálogo'));

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Cabecera */}
      <EncabezadoCatalogo />

      {/* Selector de combustible */}
      <View className="px-4 pt-2">
        <View className="flex-row gap-1 rounded-[10px] border border-border bg-muted p-1">
          {COMBUSTIBLES.map((c) => {
            const activo = cat.combustible === c.id;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
                onPress={() => cat.setCombustible(c.id)}
                className={cn('flex-1 items-center rounded-[8px] py-2', activo && 'bg-primary')}
              >
                <Text
                  className={cn(
                    'text-sm',
                    activo ? 'font-medium text-primary-foreground' : 'text-muted-foreground'
                  )}
                >
                  {c.etiqueta}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Buscador */}
      <View className="mt-2 px-4 pb-2">
        <Buscador valor={cat.busqueda} onChange={cat.setBusqueda} />
      </View>

      {/* Chips de categorías (solo las del combustible activo) */}
      {categoriasFiltradas.length > 0 && (
        <View className="pb-2">
          <ChipsCategorias
            categorias={categoriasFiltradas}
            seleccionada={cat.categoria}
            onSeleccionar={cat.setCategoria}
          />
        </View>
      )}

      {/* Cabecera de resultados */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <Text className="text-sm font-semibold tracking-tight">Modelos disponibles</Text>
        <Text className="text-xs text-muted-foreground">{cat.productos.length} artículos</Text>
      </View>

      {/* Rejilla de productos */}
      <FlatList
        style={{ flex: 1 }}
        data={cat.productos}
        keyExtractor={(p) => p.producto_id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 88 + insets.bottom }}
        renderItem={({ item }) => <TarjetaProducto producto={item} origen={origen} />}
        ListEmptyComponent={
          cat.cargando ? (
            <View className="items-center py-16">
              <ActivityIndicator color="hsl(24.6 95% 53.1%)" />
            </View>
          ) : (
            <View className="items-center gap-2 px-8 py-16">
              <Text className="text-muted-foreground">
                {cat.error ?? 'No hay productos que coincidan con la búsqueda.'}
              </Text>
              {!cat.error && (cat.busqueda || cat.categoria) && (
                <Button variant="outline" size="sm" onPress={cat.limpiarFiltros}>
                  <Text>Limpiar filtros</Text>
                </Button>
              )}
            </View>
          )
        }
        ListFooterComponent={
          cat.hayMas ? (
            <View className="px-4 pb-4 pt-2">
              <Button
                variant="outline"
                className="w-full rounded-[10px] py-2.5"
                onPress={() => cat.setPagina((p) => p + 1)}
              >
                <RefreshCw size={18} className="text-muted-foreground size-[18px]" />
                <Text>Cargar más estufas</Text>
              </Button>
            </View>
          ) : null
        }
      />

      {/* Barra de navegación inferior fija */}
      <NavInferior activa="catalogo" />
    </View>
  );
}
