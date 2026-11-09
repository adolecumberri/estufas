import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Boxes, RefreshCw, X } from 'lucide-react-native';
import { vars } from 'nativewind';
import * as React from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import banner from '../../../../assets/images/banner.jpg';

import { Buscador } from '@/features/catalogo/componentes/buscador';
import { EncabezadoCatalogo } from '@/features/catalogo/componentes/encabezado';
import TarjetaProducto from '@/features/catalogo/componentes/tarjeta-producto';
import { EmptyState, ErrorView, LoadingView } from '@/shared/componentes/estados';
import { Screen } from '@/shared/componentes/screen';
import { NavInferior } from '@/shared/navegacion/nav-inferior';
import { NavLateral } from '@/features/catalogo/componentes/nav-lateral';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { IconButton } from '@/shared/ui/icon-button';
import { Text } from '@/shared/ui/text';
import { COMBUSTIBLES } from '@/shared/constantes';
import { useProveedorActivo } from '@/features/catalogo/proveedor-activo-contexto';
import { useSolicitud } from '@/features/carrito/contexto';
import { useProveedores } from '@/features/admin/hooks/use-admin';
import { useAuth } from '@/features/auth/use-auth';
import { useCatalogo } from '@/features/catalogo/hooks/use-catalogo';
import {
  temaProveedor,
  textoSobreProveedor,
  tripletProveedor,
} from '@/shared/lib/colores-proveedor';
import { supabase } from '@/shared/lib/supabase';
import { useColoresIcono } from '@/shared/lib/theme';
import type { Proveedor } from '@/shared/lib/types';

// Pantalla raíz de la app: catálogo público. Vive como componente compartido
// para ser la ruta inicial (/) sin depender de un Redirect (que provoca el
// aviso "GO_BACK was not handled" en Android). Compone los componentes
// compartidos del catálogo (diseño Stitch): cabecera fija, navegación
// lateral por combustible, buscador, rejilla de 2 columnas con paginación y
// barra de navegación.
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
  // Catálogo acotado a un comercial (ruta /catalogo?comercial=<id> desde la
  // vista previa del admin): se listan SOLO los proveedores de ese comercial
  // (comercial_proveedor; el admin puede leerlo por RLS), no los del usuario.
  // Así el admin ve el catálogo DEL comercial, no el suyo (bug del brief §4.ii).
  const { comercial: comercialParam } = useLocalSearchParams<{ comercial?: string }>();
  const [proveedoresComercial, setProveedoresComercial] = React.useState<Proveedor[] | null>(null);
  const [proveedorScoped, setProveedorScoped] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!comercialParam) return;
    let cancelado = false;
    void (async () => {
      const { data } = await supabase
        .from('comercial_proveedor')
        .select('proveedor_id, proveedor:proveedores(id, nombre, icono, color)')
        .eq('comercial_id', comercialParam)
        .eq('habilitado', true);
      if (cancelado) return;
      const filas = (data ?? []) as {
        proveedor_id: string;
        proveedor: Proveedor | Proveedor[] | null;
      }[];
      const lista = filas
        .map((f) => (Array.isArray(f.proveedor) ? (f.proveedor[0] ?? null) : f.proveedor))
        .filter((p): p is Proveedor => p !== null);
      setProveedoresComercial(lista);
      // Primer proveedor del comercial como selección inicial (no se pisa una
      // selección ya hecha dentro de esta vista).
      setProveedorScoped((prev) => prev ?? lista[0]?.id ?? null);
    })();
    return () => {
      cancelado = true;
    };
  }, [comercialParam]);

  const proveedorId =
    proveedorIdOverride ??
    (comercialParam
      ? (proveedorScoped ?? proveedoresComercial?.[0]?.id ?? null)
      : (proveedorActivo?.id ?? null));
  const cat = useCatalogo(clienteObjetivoId, proveedorId);
  const [menuAbierto, setMenuAbierto] = React.useState(false);
  const colores = useColoresIcono();

  // Proveedor que tiñe el primario: en modo acotado, el del comercial; si no,
  // el activo del usuario (el color se usa también en el banner del override).
  const proveedorTintado = comercialParam
    ? (proveedoresComercial?.find((p) => p.id === proveedorId) ?? null)
    : proveedorActivo;

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

  // Menú lateral: opciones del proveedor activo SIEMPRE desde la BD (el hook
  // las cachea por proveedor). Nunca se cae a la lista global: mientras carga
  // se mantienen las anteriores (atenuadas) o skeletons en la primera carga.
  const filtrosMenu = cat.filtrosProveedor;

  return (
    // El PRIMARIO del catálogo es el color del proveedor activo: esta pantalla
    // SÍ está dentro del contexto de navegación, así que aquí (y solo aquí) se
    // sobreescriben las variables CSS. IMPORTANTE: las variables deben existir
    // YA en el primer render (con el verde por defecto cuando aún no hay
    // proveedor cargado). Si se añaden más tarde, NativeWind entra en su ruta
    // de "upgrade warning" y al serializar el árbol toca los getters del
    // contexto de navegación de expo-router → crash
    // ("Couldn't find a navigation context"). Por eso van SIEMPRE presentes.
    // Screen añade el fondo y la safe area superior; vars() viaja en `style`.
    <Screen
      className="flex-1"
      style={vars({
        '--primary': tripletProveedor(proveedorTintado?.color ?? null),
        '--primary-foreground': textoSobreProveedor(proveedorTintado?.color ?? null),
      })}
    >
      {/* Cabecera */}
      <EncabezadoCatalogo onAbrirMenu={() => setMenuAbierto(true)} />

      {/* Banner decorativo */}
      <Image source={banner} className="h-[60px] w-full" contentFit="cover" transition={200} />

      {/* Buscador */}
      <View className="mt-2 px-4 pb-2">
        <Buscador valor={cat.busqueda} onChange={cat.setBusqueda} />
      </View>

      {/* Banner: catálogo filtrado por proveedor (vista de admin). El nombre
          sale del primer producto cargado; sin resultados, texto genérico.
          El tinte, el borde y el texto usan el tema del color del proveedor. */}
      {proveedorIdOverride && (
        <Card
          className="mx-4 mb-2 flex-row items-center gap-2 rounded-lg border px-3 py-2"
          style={{ backgroundColor: temaBanner.tinte, borderColor: temaBanner.borde }}
        >
          <Text className="flex-1 text-sm" style={{ color: temaBanner.texto }}>
            {cat.productos[0]?.proveedor_nombre
              ? `Viendo solo el catálogo de ${cat.productos[0].proveedor_nombre}`
              : 'Solo productos de ese proveedor'}
          </Text>
          <IconButton
            icono={X}
            tamano={16}
            etiquetaAccesibilidad="Quitar filtro de proveedor"
            onPress={() => {
              // En la ruta dedicada el "quitar filtro" vuelve al catálogo
              // general (el banner solo existe en esa ruta). El typegen de
              // rutas está desactualizado tras los grupos y no incluye '/':
              // el cast mantiene el typecheck verde (se regenera al arrancar
              // el dev server).
              router.replace('/' as never);
            }}
          />
        </Card>
      )}

      {/* Aviso global del carrito (p. ej. no mezclar proveedores): el mismo
          aviso que muestra /solicitud, para que el rechazo se vea al añadir. */}
      {aviso && (
        <View className="mx-4 mb-2 flex-row items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3">
          <Text className="flex-1 text-sm">{aviso}</Text>
          <IconButton
            icono={X}
            tamano={16}
            etiquetaAccesibilidad="Cerrar aviso"
            onPress={limpiarAviso}
          />
        </View>
      )}

      {/* Cabecera de resultados */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <Text className="text-sm font-semibold tracking-tight">Modelos disponibles</Text>
        <Text className="text-xs text-muted-foreground">{cat.productos.length} artículos</Text>
      </View>

      {/* Rejilla de productos. En modo acotado a un comercial SIN proveedores
          no se muestra el catálogo completo (sería el bug del admin viendo su
          propio catálogo). */}
      {comercialParam && proveedoresComercial !== null && proveedoresComercial.length === 0 ? (
        <EmptyState titulo="Este comercial no tiene proveedores asignados" icono={Boxes} />
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          data={cat.productos}
          keyExtractor={(p) => p.producto_id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 12, paddingBottom: (session ? 88 : 24) + insets.bottom }}
          renderItem={({ item }) => (
            <TarjetaProducto producto={item} origen={origen} onAnadir={anadir} />
          )}
          ListEmptyComponent={
            cat.cargando ? (
              <LoadingView texto="Cargando modelos…" />
            ) : cat.error ? (
              <ErrorView mensaje={cat.error} />
            ) : (
              <EmptyState
                titulo="No hay productos que coincidan con la búsqueda."
                icono={Boxes}
                accion={
                  cat.busqueda || cat.categoria ? (
                    <Button variant="outline" size="sm" onPress={cat.limpiarFiltros}>
                      <Text>Limpiar filtros</Text>
                    </Button>
                  ) : undefined
                }
              />
            )
          }
          ListFooterComponent={
            cat.hayMas ? (
              <View className="px-4 pb-4 pt-2">
                <Button
                  variant="outline"
                  className="w-full rounded-lg py-2.5"
                  onPress={() => cat.setPagina((p) => p + 1)}
                >
                  <RefreshCw size={18} color={colores.tenue} className="size-[18px]" />
                  <Text>Cargar más estufas</Text>
                </Button>
              </View>
            ) : null
          }
        />
      )}

      {/* Navegación lateral (cajón): único sitio para cambiar de proveedor
          (selector dentro del cajón). En el modo acotado a un comercial se le
          pasa la lista de ESE comercial; en /catalogo/proveedor/[id] el
          proveedor es fijo y el selector se oculta. */}
      <NavLateral
        abierto={menuAbierto}
        onCerrar={() => setMenuAbierto(false)}
        combustible={cat.combustible}
        combustibles={filtrosMenu.combustibles}
        categorias={filtrosMenu.categorias}
        filtrosListos={filtrosMenu.listo}
        cargandoFiltros={filtrosMenu.cargando}
        setCombustible={cat.setCombustible}
        categoria={cat.categoria}
        setCategoria={cat.setCategoria}
        conSelectorProveedor={!proveedorIdOverride}
        proveedores={comercialParam ? (proveedoresComercial ?? []) : undefined}
        activo={comercialParam ? proveedorId : undefined}
        onSeleccionar={comercialParam ? setProveedorScoped : undefined}
      />

      {/* Barra inferior persistente: solo con sesión (los anónimos no la ven). */}
      {session && <NavInferior activa="catalogo" />}
    </Screen>
  );
}
