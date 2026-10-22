import { Image } from 'expo-image';
import { router } from 'expo-router';
import { RefreshCw, X } from 'lucide-react-native';
import { vars } from 'nativewind';
import * as React from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import banner from '../../assets/images/banner.jpg';

import { Buscador } from '@/components/catalogo/buscador';
import { EncabezadoCatalogo } from '@/components/catalogo/encabezado';
import TarjetaProducto from '@/components/catalogo/tarjeta-producto';
import { SelectorProveedor } from '@/components/catalogo/selector-proveedor';
import { NavInferior } from '@/components/navegacion/nav-inferior';
import { NavLateral } from '@/components/navegacion/nav-lateral';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { COMBUSTIBLES } from '@/constants';
import { useProveedorActivo } from '@/contexts/proveedor-activo-context';
import { useSolicitud } from '@/contexts/solicitud-context';
import { useProveedores } from '@/hooks/use-admin';
import { useAuth } from '@/hooks/use-auth';
import { useCatalogo } from '@/hooks/use-catalogo';
import { temaProveedor, textoSobreProveedor, tripletProveedor } from '@/lib/colores-proveedor';
import { useColoresIcono } from '@/lib/theme';

// Pantalla raíz de la app: catálogo público. Vive como componente compartido
// para ser la ruta inicial (/) sin depender de un Redirect (que provoca el
// aviso "GO_BACK was not handled" en Android). Compone los componentes
// compartidos del catálogo (diseño Stitch): cabecera fija, navegación
// lateral por combustible, buscador, chips de categorías, rejilla de 2
// columnas con paginación y barra de navegación.
//
// `proveedorIdOverride` permite montar ESTA misma pantalla desde la ruta
// dedicada /catalogo/proveedor/[id] (catálogo de un proveedor concreto).
export default function CatalogoScreen({
  proveedorIdOverride,
}: {
  proveedorIdOverride?: string | null;
} = {}) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { clienteObjetivoId, aviso, limpiarAviso, anadir } = useSolicitud();
  // Filtro por proveedor: la ruta dedicada fija uno (prop); si no, el
  // proveedor activo del contexto (un solo proveedor a la vez).
  const { activo: proveedorActivo } = useProveedorActivo();
  const proveedorId = proveedorIdOverride ?? proveedorActivo?.id ?? null;
  const cat = useCatalogo(clienteObjetivoId, proveedorId);
  const [menuAbierto, setMenuAbierto] = React.useState(false);
  const colores = useColoresIcono();

  // Al cambiar de proveedor se reinician búsqueda/categoría/página para no
  // arrastrar filtros de la selección anterior. limpiarFiltros se recrea en
  // cada render y no entra en las dependencias: así no pisa lo que el usuario
  // está tecleando mientras el proveedor no cambia.
  React.useEffect(() => {
    cat.limpiarFiltros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedorId]);

  // Color del proveedor filtrado para el banner: se busca por el id del
  // primer producto cargado. Solo el admin llega a esta vista; si el hook
  // devuelve error/lista vacía (o no hay color), temaProveedor usa el
  // primario global como fallback.
  const { proveedores: proveedoresAdmin } = useProveedores();
  const proveedorIdActivo = cat.productos[0]?.proveedor_id ?? null;
  const colorProveedorActivo = proveedorIdActivo
    ? (proveedoresAdmin.find((pr) => pr.id === proveedorIdActivo)?.color ?? null)
    : null;
  const temaBanner = temaProveedor(colorProveedorActivo);

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
    // El PRIMARIO del catálogo es el color del proveedor activo: al cambiar de
    // proveedor se re-pinta (--primary/--primary-foreground) todo el catálogo y
    // su barra inferior. El resto de la app usa el verde por defecto de la
    // global.css (no relacionado con proveedores).
    <View
      className="flex-1 bg-background"
      style={[
        { paddingTop: insets.top },
        proveedorActivo
          ? vars({
              '--primary': tripletProveedor(proveedorActivo.color),
              '--primary-foreground': textoSobreProveedor(proveedorActivo.color),
            })
          : undefined,
      ]}
    >
      {/* Cabecera */}
      <EncabezadoCatalogo onAbrirMenu={() => setMenuAbierto(true)} />

      {/* Banner decorativo */}
      <Image source={banner} className="h-[60px] w-full" contentFit="cover" transition={200} />

      {/* Selector de proveedor (solo en el catálogo general: la ruta dedicada
          tiene su proveedor fijo y su propio banner). */}
      {!proveedorIdOverride && (
        <View className="mt-2">
          <SelectorProveedor />
        </View>
      )}

      {/* Buscador */}
      <View className="mt-2 px-4 pb-2">
        <Buscador valor={cat.busqueda} onChange={cat.setBusqueda} />
      </View>

      {/* Banner: catálogo filtrado por proveedor (vista de admin). El nombre
          sale del primer producto cargado; sin resultados, texto genérico.
          El tinte, el borde y el texto usan el tema del color del proveedor. */}
      {proveedorIdOverride && (
        <View
          className="mx-4 mb-2 flex-row items-center gap-2 rounded-[10px] border px-3 py-2"
          style={{ backgroundColor: temaBanner.tinte, borderColor: temaBanner.borde }}
        >
          <Text className="flex-1 text-sm" style={{ color: temaBanner.texto }}>
            {cat.productos[0]?.proveedor_nombre
              ? `Viendo solo el catálogo de ${cat.productos[0].proveedor_nombre}`
              : 'Solo productos de ese proveedor'}
          </Text>
          <Pressable
            onPress={() => {
              // En la ruta dedicada el "quitar filtro" vuelve al catálogo
              // general (el banner solo existe en esa ruta).
              router.replace('/');
            }}
            className="rounded-md p-0.5 active:bg-accent"
            accessibilityLabel="Quitar filtro de proveedor"
          >
            <X size={16} color={colores.tenue} />
          </Pressable>
        </View>
      )}

      {/* Aviso global del carrito (p. ej. no mezclar proveedores): el mismo
          aviso que muestra /solicitud, para que el rechazo se vea al añadir. */}
      {aviso && (
        <View className="mx-4 mb-2 flex-row items-start gap-2 rounded-[10px] border border-primary/40 bg-primary/10 p-3">
          <Text className="flex-1 text-sm">{aviso}</Text>
          <Pressable
            onPress={limpiarAviso}
            className="rounded-md p-0.5 active:bg-accent"
            accessibilityLabel="Cerrar aviso"
          >
            <X size={16} color={colores.tenue} />
          </Pressable>
        </View>
      )}

      {/* Cabecera de resultados */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <Text className="text-sm font-semibold tracking-tight">Modelos disponibles</Text>
        <Text className="text-xs text-muted-foreground">{cat.productos.length} artículos</Text>
      </View>

      {/* Rejilla de productos */}
      <FlatList
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        data={cat.productos}
        keyExtractor={(p) => p.producto_id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingBottom: (session ? 88 : 24) + insets.bottom }}
        renderItem={({ item }) => <TarjetaProducto producto={item} origen={origen} onAnadir={anadir} />}
        ListEmptyComponent={
          cat.cargando ? (
            <View className="items-center py-16">
              <ActivityIndicator color="hsl(124.3 17.7% 31%)" />
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
                <RefreshCw size={18} color={colores.tenue} className="size-[18px]" />
                <Text>Cargar más estufas</Text>
              </Button>
            </View>
          ) : null
        }
      />

      {/* Navegación lateral (cajón) */}
      <NavLateral
        abierto={menuAbierto}
        onCerrar={() => setMenuAbierto(false)}
        combustible={cat.combustible}
        categorias={cat.categorias}
        setCombustible={cat.setCombustible}
        categoria={cat.categoria}
        setCategoria={cat.setCategoria}
      />

      {/* Barra inferior persistente: solo con sesión (los anónimos no la ven). */}
      {session && <NavInferior activa="catalogo" />}
    </View>
  );
}
