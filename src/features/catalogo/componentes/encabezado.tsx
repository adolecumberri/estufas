import { router } from 'expo-router';
import { Flame, LogIn, Menu, ShoppingCart } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Badge } from '@/shared/ui/badge';
import { IconButton } from '@/shared/ui/icon-button';
import { Text } from '@/shared/ui/text';
import { APP, RUTAS } from '@/shared/constantes';
import { AccionCuenta } from '@/shared/componentes/accion-cuenta';
import { useSolicitud } from '@/features/carrito/contexto';
import { useAuth } from '@/features/auth/use-auth';
import { useColoresIcono } from '@/shared/lib/theme';

// Cabecera fija del catálogo (diseño Stitch): marca + acceso al carrito y a
// la cuenta. Con `onAbrirMenu` se muestra el botón que abre la navegación
// lateral.
//
// La burbuja de cuenta del usuario logeado está SIEMPRE visible (incluido el
// admin): misma componente y hoja que el resto de la app (AccionCuenta, con
// info + "Mi cuenta" + "Cerrar sesión"). Sin sesión se muestra el icono de
// Iniciar sesión. (Feedback 2026-11-10 punto 3: la burbuja vive en el top
// navbar por defecto; el "Mi cuenta" del drawer puede quedarse.)
export function EncabezadoCatalogo({ onAbrirMenu }: { onAbrirMenu?: () => void }) {
  const { session, perfil } = useAuth();
  const { lineas, clienteObjetivoId } = useSolicitud();
  const colores = useColoresIcono();

  const totalLineas = lineas.reduce((acc, l) => acc + l.cantidad, 0);

  // El admin no ve el carrito: no tiene carrito:usar (decisión S0, 10/11/2026).
  const mostrarCarrito = session && perfil?.rol !== 'admin';

  return (
    <View className="h-16 flex-row items-center justify-between border-b border-border bg-background px-4">
      <View className="flex-row items-center gap-2">
        {onAbrirMenu && (
          <IconButton
            icono={Menu}
            tamano={24}
            etiquetaAccesibilidad="Abrir menú de navegación"
            onPress={onAbrirMenu}
          />
        )}
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Flame size={22} color={colores.primario} />
        </View>
        <Text className="text-xl font-bold tracking-tight">{APP.nombre}</Text>
      </View>

      <View className="flex-row items-center gap-1.5">
        {/* El carrito solo existe con sesión: sin login no se puede poblar
            (los botones "Añadir" no se muestran) y no debe confundir. */}
        {mostrarCarrito && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              totalLineas > 0
                ? `Ver carrito de compras, ${totalLineas} artículos`
                : 'Ver carrito de compras'
            }
            onPress={() => router.push('/solicitud')}
            className="relative rounded-lg p-2 active:bg-muted"
          >
            <ShoppingCart size={20} color={colores.primerPlano} />
            {totalLineas > 0 && (
              <View className="absolute -right-0.5 -top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1">
                <Text className="text-[10px] font-bold leading-tight text-primary-foreground">
                  {totalLineas}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {clienteObjetivoId && (
          <Badge variant="outline">
            <Text>Para cliente</Text>
          </Badge>
        )}

        {session ? (
          <AccionCuenta />
        ) : (
          <IconButton
            icono={LogIn}
            tamano={20}
            etiquetaAccesibilidad="Iniciar sesión"
            onPress={() => router.push(RUTAS.login)}
          />
        )}
      </View>
    </View>
  );
}
