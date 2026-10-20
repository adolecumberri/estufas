import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LogIn, Search, ShoppingCart, UserRound } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { APP } from '@/constants';
import { useSolicitud } from '@/contexts/solicitud-context';
import { useAuth } from '@/hooks/use-auth';
import { useCatalogo } from '@/hooks/use-catalogo';
import { formatEUR, formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProductoCatalogo } from '@/lib/types';

function TarjetaProducto({ producto }: { producto: ProductoCatalogo }) {
  return (
    <Pressable
      onPress={() => router.push(`/catalogo/${producto.producto_id}`)}
      className="flex-1 active:opacity-80"
    >
      <Card className="gap-0 overflow-hidden rounded-lg p-0">
        <Image
          source={{ uri: producto.imagen_url ?? undefined }}
          className="aspect-square w-full bg-muted"
          contentFit="cover"
          transition={200}
        />
        <View className="gap-1 p-3">
          <Text numberOfLines={2} className="text-sm font-medium">
            {producto.nombre}
          </Text>
          <Text numberOfLines={1} className="text-xs text-muted-foreground">
            {producto.marca ?? ''} {producto.marca ? '·' : ''} {producto.referencia}
          </Text>
          <View className="mt-1 flex-row items-baseline gap-1.5">
            <Text className="text-base font-semibold">{formatEUR(producto.precio_final)}</Text>
            {producto.descuento_pct > 0 && (
              <Text className="text-xs text-muted-foreground line-through">
                {formatEUR(producto.precio_base)}
              </Text>
            )}
          </View>
          {producto.descuento_pct > 0 && (
            <Badge variant="secondary" className="self-start">
              <Text>{formatPct(producto.descuento_pct)} dto.</Text>
            </Badge>
          )}
          {producto.etiqueta_energetica && (
            <Badge variant="outline" className="absolute right-2 top-2 bg-background">
              <Text>{producto.etiqueta_energetica}</Text>
            </Badge>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

export default function Catalogo() {
  const insets = useSafeAreaInsets();
  const { session, perfil } = useAuth();
  const { lineas, clienteObjetivoId } = useSolicitud();
  const cat = useCatalogo(clienteObjetivoId);

  const totalLineas = lineas.reduce((acc, l) => acc + l.cantidad, 0);

  const destinoCuenta = () => {
    if (!session) {
      router.push('/acceso');
      return;
    }
    if (perfil?.rol === 'admin') router.push('/admin');
    else if (perfil?.rol === 'comercial') router.push('/cartera');
    else router.push('/pedidos');
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Cabecera */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <Text className="text-xl font-bold tracking-tight">{APP.nombre}</Text>
        <View className="flex-row items-center gap-2">
          {clienteObjetivoId && (
            <Badge variant="outline">
              <Text>Para cliente</Text>
            </Badge>
          )}
          <Pressable
            onPress={() => router.push('/solicitud')}
            className="relative rounded-md p-2 active:bg-accent"
          >
            <ShoppingCart size={20} className="text-foreground" />
            {totalLineas > 0 && (
              <View className="absolute -right-0.5 -top-0.5 min-w-[16px] items-center rounded-full bg-primary px-1">
                <Text className="text-[10px] font-bold text-primary-foreground">{totalLineas}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={destinoCuenta} className="rounded-md p-2 active:bg-accent">
            {session ? (
              <UserRound size={20} className="text-foreground" />
            ) : (
              <LogIn size={20} className="text-foreground" />
            )}
          </Pressable>
        </View>
      </View>

      {/* Buscador */}
      <View className="px-4 pb-2">
        <View className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-2 text-muted-foreground" />
          <TextInput
            value={cat.busqueda}
            onChangeText={cat.setBusqueda}
            placeholder="Buscar por nombre o referencia"
            placeholderTextColor="hsl(240 3.8% 46.1%)"
            className="h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground web:outline-none"
          />
        </View>
      </View>

      {/* Filtros */}
      {(cat.categorias.length > 0 || cat.marcas.length > 0) && (
        <View className="pb-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
            <View className="flex-row gap-2">
              {cat.categorias.map((c) => {
                const activa = cat.categoria === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => cat.setCategoria(activa ? null : c.id)}
                    className={cn(
                      'rounded-full border border-border px-3 py-1.5',
                      activa ? 'border-primary bg-primary' : 'bg-background'
                    )}
                  >
                    <Text className={cn('text-xs', activa ? 'text-primary-foreground' : 'text-foreground')}>
                      {c.nombre}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Resultados */}
      <FlatList
        data={cat.productos}
        keyExtractor={(p) => p.producto_id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => <TarjetaProducto producto={item} />}
        ListEmptyComponent={
          cat.cargando ? (
            <View className="items-center py-16">
              <ActivityIndicator color="hsl(24.6 95% 53.1%)" />
            </View>
          ) : (
            <View className="items-center gap-2 px-8 py-16">
              <Text className="text-muted-foreground">
                {cat.error ? cat.error : 'No hay productos que coincidan con la búsqueda.'}
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
            <View className="items-center pb-4 pt-2">
              <Button variant="outline" size="sm" onPress={() => cat.setPagina((p) => p + 1)}>
                <Text>Cargar más</Text>
              </Button>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}
