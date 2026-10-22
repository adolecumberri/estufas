import { router } from 'expo-router';
import { Flame, LogIn, X } from 'lucide-react-native';
import * as React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { APP, COMBUSTIBLES, RUTAS } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import type { Categoria, Combustible } from '@/lib/types';
import { useColoresIcono } from '@/lib/theme';
import { cn } from '@/lib/utils';

// Navegación lateral (cajón) del catálogo: las dos secciones de combustible
// con sus subsecciones y, al pie, el acceso a la cuenta. El estado del
// catálogo lo posee la pantalla; aquí solo se recibe y se actualiza.
export function NavLateral({
  abierto,
  onCerrar,
  combustible,
  categorias,
  setCombustible,
  categoria,
  setCategoria,
}: {
  abierto: boolean;
  onCerrar: () => void;
  combustible: Combustible;
  categorias: Categoria[];
  setCombustible: (c: Combustible) => void;
  categoria: string | null;
  setCategoria: (id: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const { session, perfil } = useAuth();
  const colores = useColoresIcono();

  // Categorías sin combustible asignado (agnósticas): se muestran siempre,
  // independientemente de la sección de combustible seleccionada.
  const agnosticas = categorias.filter((x) => x.combustible === null);

  const destinoCuenta = () => {
    if (perfil?.rol === 'admin') return RUTAS.admin;
    if (perfil?.rol === 'comercial') return RUTAS.cartera;
    return RUTAS.pedidos;
  };

  return (
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
          style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}
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

          {/* Secciones: combustibles con sus subsecciones */}
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            {COMBUSTIBLES.map((c) => {
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
                    <View className={cn('rounded-[10px] px-3 py-2.5', activo && 'bg-primary')}>
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
                  <View className="rounded-[10px] px-3 py-2.5">
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
          </ScrollView>

          {/* Pie del panel: acceso a la cuenta */}
          <View className="border-t border-border p-3">
            {session ? (
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
  );
}
