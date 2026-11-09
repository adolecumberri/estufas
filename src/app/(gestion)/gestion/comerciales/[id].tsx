import { router, useLocalSearchParams } from 'expo-router';
import { Flame, ReceiptText, Users } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { AccionCuenta } from '@/shared/componentes/accion-cuenta';
import { EmptyState, ErrorView, LoadingView } from '@/shared/componentes/estados';
import { ListCard } from '@/shared/componentes/list-card';
import { ScreenScroll } from '@/shared/componentes/screen';
import { ScreenHeader } from '@/shared/componentes/screen-header';
import { Text } from '@/shared/ui/text';
import { supabase } from '@/shared/lib/supabase';
import { useColoresIcono } from '@/shared/lib/theme';
import type { PerfilUsuario } from '@/shared/lib/types';

// Ficha de un comercial (vista del admin): en lugar de duplicar las pantallas
// de cartera/pedidos, ENLAZA a las rutas compartidas con el alcance por query
// (?comercial=<id>) — decisión 10/11/2026 (sin "modos": el admin opera dentro
// de esas rutas y cada operación queda registrada con su usuario).
export default function GestionComercialDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colores = useColoresIcono();

  const [comercial, setComercial] = React.useState<PerfilUsuario | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    void (async () => {
      const { data, error: err } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (cancelado) return;
      setCargando(false);
      if (err) setError(err.message);
      else setComercial((data as PerfilUsuario | null) ?? null);
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  const nombre = comercial
    ? `${comercial.nombre} ${comercial.apellidos ?? ''}`.trim()
    : 'Comercial';

  return (
    <ScreenScroll contentClassName="pb-24">
      <ScreenHeader
        titulo={nombre}
        subtitulo={comercial?.email ?? undefined}
        respaldo="/gestion/comerciales"
        accion={<AccionCuenta />}
      />

      {cargando ? (
        <LoadingView />
      ) : error ? (
        <ErrorView mensaje={error} />
      ) : !comercial ? (
        <EmptyState titulo="Comercial no encontrado" />
      ) : (
        <View className="gap-3">
          <Text className="text-xs text-muted-foreground">
            Abre las mismas pantallas del comercial con el alcance fijado en este comercial.
            Las operaciones que hagas aquí quedan registradas con tu usuario.
          </Text>

          <ListCard onPress={() => router.push(`/cartera?comercial=${id ?? ''}`)}>
            <View className="flex-row items-center gap-3">
              <Users size={20} color={colores.primario} />
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-semibold">Cartera del comercial</Text>
                <Text className="text-xs text-muted-foreground">
                  Clientes asignados y sus condiciones
                </Text>
              </View>
            </View>
          </ListCard>

          <ListCard onPress={() => router.push(`/pedidos?comercial=${id ?? ''}`)}>
            <View className="flex-row items-center gap-3">
              <ReceiptText size={20} color={colores.primario} />
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-semibold">Pedidos del comercial</Text>
                <Text className="text-xs text-muted-foreground">
                  Confirmar, avanzar y cancelar pedidos de su cartera
                </Text>
              </View>
            </View>
          </ListCard>

          <ListCard onPress={() => router.push(`/catalogo?comercial=${id ?? ''}`)}>
            <View className="flex-row items-center gap-3">
              <Flame size={20} color={colores.primario} />
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-semibold">Catálogo del comercial</Text>
                <Text className="text-xs text-muted-foreground">
                  Productos de sus proveedores habilitados
                </Text>
              </View>
            </View>
          </ListCard>
        </View>
      )}
    </ScreenScroll>
  );
}
