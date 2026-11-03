import { router } from 'expo-router';
import { Flame, LogIn, Menu, ShoppingCart, UserRound } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { APP, RUTAS } from '@/constants';
import { useSolicitud } from '@/contexts/solicitud-context';
import { useAuth } from '@/hooks/use-auth';
import { useColoresIcono } from '@/lib/theme';

// Cabecera fija del catálogo (diseño Stitch): marca + acceso al carrito y a
// la cuenta. El destino de la cuenta depende del rol del perfil autenticado.
// Con `onAbrirMenu` se muestra el botón que abre la navegación lateral.
export function EncabezadoCatalogo({ onAbrirMenu }: { onAbrirMenu?: () => void }) {
  const { session, perfil } = useAuth();
  const { lineas, clienteObjetivoId } = useSolicitud();
  const colores = useColoresIcono();

  const totalLineas = lineas.reduce((acc, l) => acc + l.cantidad, 0);

  const destinoCuenta = () => {
    if (!session) {
      router.push(RUTAS.login);
      return;
    }
    // El acceso de administración vive en la pestaña Admin del navbar
    // inferior (5ª pestaña del admin), no en la cabecera.
    if (perfil?.rol === 'comercial') router.push(RUTAS.cartera);
    else router.push(RUTAS.pedidos);
  };

  // El admin no usa el icono de cuenta de la cabecera: su acceso al panel
  // está en la barra inferior.
  const mostrarCuenta = !(session && perfil?.rol === 'admin');
  // El admin tampoco ve el carrito: navega el catálogo en solo lectura.
  const mostrarCarrito = session && perfil?.rol !== 'admin';

  return (
    <View className="h-16 flex-row items-center justify-between border-b border-border bg-background px-4">
      <View className="flex-row items-center gap-2">
        {onAbrirMenu && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir menú de navegación"
            onPress={onAbrirMenu}
            className="rounded-lg p-2 active:bg-muted"
          >
            <Menu size={22} color={colores.primerPlano} />
          </Pressable>
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
              totalLineas > 0 ? `Ver carrito de compras, ${totalLineas} artículos` : 'Ver carrito de compras'
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

        {mostrarCuenta && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={session ? 'Cuenta de usuario' : 'Iniciar sesión'}
            onPress={destinoCuenta}
            className="rounded-lg p-2 active:bg-muted"
          >
            {session ? (
              <UserRound size={20} color={colores.primerPlano} />
            ) : (
              <LogIn size={20} color={colores.primerPlano} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
