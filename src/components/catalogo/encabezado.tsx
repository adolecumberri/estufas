import { router } from 'expo-router';
import { Flame, LogIn, ShoppingCart, UserRound } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { APP, RUTAS } from '@/constants';
import { useSolicitud } from '@/contexts/solicitud-context';
import { useAuth } from '@/hooks/use-auth';

// Cabecera fija del catálogo (diseño Stitch): marca + acceso al carrito y a
// la cuenta. El destino de la cuenta depende del rol del perfil autenticado.
export function EncabezadoCatalogo() {
  const { session, perfil } = useAuth();
  const { lineas, clienteObjetivoId } = useSolicitud();

  const totalLineas = lineas.reduce((acc, l) => acc + l.cantidad, 0);

  const destinoCuenta = () => {
    if (!session) {
      router.push(RUTAS.login);
      return;
    }
    if (perfil?.rol === 'admin') router.push(RUTAS.admin);
    else if (perfil?.rol === 'comercial') router.push(RUTAS.cartera);
    else router.push(RUTAS.pedidos);
  };

  return (
    <View className="h-14 flex-row items-center justify-between border-b border-border bg-background px-4">
      <View className="flex-row items-center gap-2">
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Flame size={22} className="text-primary" />
        </View>
        <Text className="text-xl font-bold tracking-tight">{APP.nombre}</Text>
      </View>

      <View className="flex-row items-center gap-1.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            totalLineas > 0 ? `Ver carrito de compras, ${totalLineas} artículos` : 'Ver carrito de compras'
          }
          onPress={() => router.push('/solicitud')}
          className="relative rounded-lg p-2 active:bg-muted"
        >
          <ShoppingCart size={20} className="text-foreground" />
          {totalLineas > 0 && (
            <View className="absolute -right-0.5 -top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1">
              <Text className="text-[10px] font-bold leading-tight text-primary-foreground">
                {totalLineas}
              </Text>
            </View>
          )}
        </Pressable>

        {clienteObjetivoId && (
          <Badge variant="outline">
            <Text>Para cliente</Text>
          </Badge>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={session ? 'Cuenta de usuario' : 'Iniciar sesión'}
          onPress={destinoCuenta}
          className="rounded-lg p-2 active:bg-muted"
        >
          {session ? (
            <UserRound size={20} className="text-foreground" />
          ) : (
            <LogIn size={20} className="text-foreground" />
          )}
        </Pressable>
      </View>
    </View>
  );
}
