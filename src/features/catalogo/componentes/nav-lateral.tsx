import { router } from 'expo-router';
import { Boxes, Flame, Flower, LogIn, LogOut, X } from 'lucide-react-native';
import { vars } from 'nativewind';
import * as React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/shared/ui/button';
import { Text } from '@/shared/ui/text';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { APP, COMBUSTIBLES, RUTAS } from '@/shared/constantes';
import { useAuth } from '@/features/auth/use-auth';
import { usePermisos } from '@/shared/seguridad/use-permisos';
import { useProveedorActivo } from '@/features/catalogo/proveedor-activo-contexto';
import { useCambioProveedor } from '@/features/catalogo/use-cambio-proveedor';
import type { Categoria, Combustible, Proveedor } from '@/shared/lib/types';
import {
  textoSobreProveedor,
  temaProveedor,
  tripletProveedor,
} from '@/shared/lib/colores-proveedor';
import { supabase } from '@/shared/lib/supabase';
import { useColoresIcono } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

// Icono lucide según el campo `icono` del proveedor (seed: 'flame'/'flower').
// Cualquier valor no reconocido cae en Flame.
function IconoProveedor({
  icono,
  size,
  color,
}: {
  icono?: string | null;
  size: number;
  color: string;
}) {
  const Icono = icono === 'flower' ? Flower : icono === 'boxes' ? Boxes : Flame;
  return <Icono size={size} color={color} />;
}

// Navegación lateral (cajón) del catálogo: selector de proveedores (si hay
// varios), las secciones de combustible que EXISTEN en el proveedor activo
// (prop `combustibles`) con sus subsecciones (categorías de ese proveedor) y,
// al pie, el acceso a la cuenta. El estado del catálogo lo posee la pantalla;
// aquí solo se recibe y se actualiza.
//
// El cajón vive en un <Modal> nativo: las variables CSS del root (vars del
// color del proveedor) NO cruzan esa frontera, así que el panel re-aplica la
// misma tripleta para que los acentos se tiñan con el proveedor activo.
export function NavLateral({
  abierto,
  onCerrar,
  combustible,
  combustibles,
  categorias,
  setCombustible,
  categoria,
  setCategoria,
  conSelectorProveedor = true,
  proveedores,
  activo,
  onSeleccionar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  combustible: Combustible;
  /** Combustibles presentes en los productos del proveedor activo. */
  combustibles: Combustible[];
  categorias: Categoria[];
  setCombustible: (c: Combustible) => void;
  categoria: string | null;
  setCategoria: (id: string | null) => void;
  /** Muestra el selector de proveedores dentro del cajón (solo catálogo
      general; la ruta dedicada /catalogo/proveedor/[id] lo oculta). */
  conSelectorProveedor?: boolean;
  /** Lista/activo/selección EXTERNOS (catálogo acotado a un comercial vía
      /catalogo?comercial=<id>): sustituyen al contexto global y el cambio es
      directo (sin diálogo de vaciar carrito: es una vista de consulta). */
  proveedores?: Proveedor[];
  activo?: string | null;
  onSeleccionar?: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { puede } = usePermisos();
  const colores = useColoresIcono();
  const { proveedores: proveedoresLista, activo: proveedorActivo } = useProveedorActivo();
  const cambio = useCambioProveedor();

  // Selector del cajón: lista externa (modo acotado a un comercial) o la del
  // contexto. En modo externo el cambio es directo y no usa el diálogo de
  // vaciar carrito; en modo contexto usa el flujo compartido.
  const proveedoresChips = proveedores ?? proveedoresLista;
  const activoChips = activo ?? (proveedorActivo?.id ?? null);
  const proveedorTintado = proveedores
    ? (proveedores.find((p) => p.id === activoChips) ?? null)
    : proveedorActivo;

  const pulsarProveedor = (id: string) => {
    if (onSeleccionar) {
      if (activoChips === id) return;
      onSeleccionar(id);
      return;
    }
    cambio.pulsar(id);
  };

  // Categorías sin combustible asignado (agnósticas): se muestran siempre,
  // independientemente de la sección de combustible seleccionada.
  const agnosticas = categorias.filter((x) => x.combustible === null);

  // Destino de "Mi cuenta" según capacidades (no por comparación de rol):
  // admin → su panel de gestión; comercial → su cartera; cliente → sus pedidos.
  const destinoCuenta = () => {
    if (puede('admin:acceder')) return RUTAS.gestion;
    if (puede('cartera:ver_clientes')) return RUTAS.cartera;
    return RUTAS.pedidos;
  };

  // Cierre de sesión local (la sesión de la cuenta queda invalidada en este
  // dispositivo). Si falla, no se cierra el menú ni se navega: el usuario
  // sigue dentro y puede reintentar.
  const cerrarSesionLocal = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) return;
      onCerrar();
    } catch {
      // sin efecto: se mantiene la sesión y el menú abierto
    }
  };

  return (
    <>
      <Modal transparent animationType="slide" visible={abierto} onRequestClose={onCerrar}>
        <View className="flex-1">
          {/* Fondo oscurecido: tocar fuera cierra el menú */}
          <Pressable
            accessibilityLabel="Cerrar menú de navegación"
            className="absolute inset-0 bg-black/40"
            onPress={onCerrar}
          />

          {/* Panel lateral */}
          <View
            className="absolute bottom-0 left-0 top-0 w-72 max-w-[85%] rounded-r-xl border-r border-border bg-background"
            style={[
              { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 },
              // Re-aplica la tripleta del proveedor DENTRO del Modal: las
              // variables CSS del root no cruzan la frontera nativa del Modal y
              // sin esto los acentos (bg-primary/text-primary) saldrían con el
              // primario por defecto, no con el color del proveedor activo.
              vars({
                '--primary': tripletProveedor(proveedorTintado?.color ?? null),
                '--primary-foreground': textoSobreProveedor(proveedorTintado?.color ?? null),
              }),
            ]}
          >
            {/* Cabecera del panel */}
            <View className="flex-row items-center justify-between px-4 pb-2">
              <View className="flex-row items-center gap-2">
                <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Flame size={20} color={colores.primario} />
                </View>
                <Text className="text-lg font-bold">{APP.nombre}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar menú de navegación"
                onPress={onCerrar}
                className="rounded-lg p-2 active:bg-muted"
              >
                <X size={20} color={colores.tenue} />
              </Pressable>
            </View>

            {/* Secciones: SOLO los combustibles que existen en el proveedor
              activo (el orden de las etiquetas lo da COMBUSTIBLES), cada una
              con las categorías de ese proveedor. */}
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {/* Selector de proveedores dentro del cajón: misma lista del
                selector del cuerpo (contexto), con color e icono. Solo en el
                catálogo general y con más de un proveedor (en la ruta
                dedicada /catalogo/proveedor/[id] el proveedor es fijo). */}
              {conSelectorProveedor && proveedoresChips.length > 1 && (
                <View className="border-b border-border px-4 pb-3 pt-1">
                  <Text className="mb-2 text-xs font-semibold text-muted-foreground">
                    Proveedor
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {proveedoresChips.map((p) => {
                      const esActivo = activoChips === p.id;
                      const tema = temaProveedor(p.color);
                      const colorTexto = textoSobreProveedor(p.color);
                      return (
                        <Pressable
                          key={p.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: esActivo }}
                          accessibilityLabel={`Proveedor ${p.nombre}${esActivo ? ' (activo)' : ''}`}
                          onPress={() => pulsarProveedor(p.id)}
                          className={cn(
                            'flex-row items-center gap-1.5 rounded-lg border border-border px-3 py-1.5',
                            !esActivo && 'bg-muted'
                          )}
                          style={
                            esActivo
                              ? { backgroundColor: tema.base, borderColor: tema.base }
                              : undefined
                          }
                        >
                          <IconoProveedor
                            icono={p.icono}
                            size={14}
                            color={esActivo ? colorTexto : colores.tenue}
                          />
                          <Text
                            className={cn(
                              'text-xs font-medium',
                              !esActivo && 'text-muted-foreground'
                            )}
                            style={esActivo ? { color: colorTexto } : undefined}
                          >
                            {p.nombre}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
              {COMBUSTIBLES.filter((c) => combustibles.includes(c.id)).map((c) => {
                const activo = combustible === c.id;
                const subsecciones = categorias.filter(
                  (x) => x.combustible === c.id && x.clave !== 'pellet' && x.clave !== 'lena'
                );
                return (
                  <View key={c.id}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: activo }}
                      // Elegir combustible aplica el filtro y cierra el cajón.
                      onPress={() => {
                        setCombustible(c.id);
                        onCerrar();
                      }}
                      className="px-4 py-1.5"
                    >
                      <View className={cn('rounded-lg px-3 py-2.5', activo && 'bg-primary')}>
                        <Text
                          className={cn(
                            'text-sm font-semibold',
                            activo ? 'text-primary-foreground' : 'text-foreground'
                          )}
                        >
                          {c.etiqueta}
                        </Text>
                      </View>
                    </Pressable>

                    {subsecciones.map((x) => {
                      const activa = x.id === categoria;
                      return (
                        <Pressable
                          key={x.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: activa }}
                          onPress={() => {
                            // Si la subsección pertenece al combustible inactivo,
                            // se cambia el combustible antes que la categoría
                            // (ambos filtros a la vez dejarían el catálogo vacío).
                            if (!activo) setCombustible(c.id);
                            setCategoria(activa ? null : x.id);
                            onCerrar();
                          }}
                          className="rounded-[8px] py-2 pl-8 pr-4 active:bg-accent"
                        >
                          <Text
                            className={cn(
                              'text-sm',
                              activa ? 'font-medium text-primary' : 'text-muted-foreground'
                            )}
                          >
                            {x.nombre}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}

              {/* Categorías agnósticas (sin combustible): se listan bajo
                "General" y no dependen del combustible activo; el RPC filtra
                por p_categoria de forma independiente. */}
              {agnosticas.length > 0 && (
                <View className="pt-1">
                  <View className="px-4 py-1.5">
                    <View className="rounded-lg px-3 py-2.5">
                      <Text className="text-sm font-semibold text-foreground">General</Text>
                    </View>
                  </View>
                  {agnosticas.map((x) => {
                    const activa = x.id === categoria;
                    return (
                      <Pressable
                        key={x.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: activa }}
                        onPress={() => {
                          // La categoría agnóstica no depende del combustible:
                          // solo se fija la categoría y se cierra el cajón. Una
                          // segunda pulsación sobre la activa la deselecciona.
                          setCategoria(activa ? null : x.id);
                          onCerrar();
                        }}
                        className="rounded-[8px] py-2 pl-8 pr-4 active:bg-accent"
                      >
                        <Text
                          className={cn(
                            'text-sm',
                            activa ? 'font-medium text-primary' : 'text-muted-foreground'
                          )}
                        >
                          {x.nombre}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Caso límite: el proveedor no tiene combustibles ni categorías
                agnósticas (no debería pasar con datos sanos). */}
              {combustibles.length === 0 && agnosticas.length === 0 && (
                <Text className="px-4 py-3 text-sm text-muted-foreground">
                  Este proveedor no tiene categorías.
                </Text>
              )}
            </ScrollView>

            {/* Pie del panel: acceso a la cuenta y cierre de sesión */}
            <View className="border-t border-border p-3">
              {session ? (
                <View className="gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onPress={() => {
                      router.push(destinoCuenta());
                      onCerrar();
                    }}
                  >
                    <Text>Mi cuenta</Text>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onPress={() => void cerrarSesionLocal()}
                  >
                    <LogOut size={16} color={colores.destructivo} />
                    <Text className="text-destructive">Cerrar sesión</Text>
                  </Button>
                </View>
              ) : (
                <Button
                  className="w-full"
                  onPress={() => {
                    router.push(RUTAS.login);
                    onCerrar();
                  }}
                >
                  <LogIn size={16} color={colores.primarioClaro} />
                  <Text>Iniciar sesión</Text>
                </Button>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmación de cambio de proveedor con carrito no vacío: mismo
          flujo que el selector del cuerpo (ARQUITECTURA_ROLES.md §5.2).
          Tras confirmar, el cajón queda abierto y se actualiza solo. */}
      <ConfirmDialog
        visible={cambio.pendiente !== null}
        titulo="¿Cambiar de proveedor?"
        mensaje={`Tu carrito tiene ${cambio.totalArticulos} artículo${
          cambio.totalArticulos === 1 ? '' : 's'
        } de ${cambio.nombreProveedorCarrito}. Al cambiar se vaciará.`}
        textoConfirmar="Cambiar y vaciar"
        textoCancelar="Cancelar"
        onConfirmar={cambio.confirmarCambio}
        onCancelar={cambio.cancelar}
      />
    </>
  );
}
