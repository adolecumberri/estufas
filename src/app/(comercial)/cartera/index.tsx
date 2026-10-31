import { router } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TarjetaCliente } from '@/features/cartera/componentes/tarjeta-cliente';
import { NavInferior } from '@/shared/navegacion/nav-inferior';
import { Text } from '@/shared/ui/text';
import { useAuth } from '@/features/auth/use-auth';
import { useCartera } from '@/features/cartera/hooks/use-comercial';
import { supabase } from '@/shared/lib/supabase';

// Resumen por cliente para las tarjetas: descuentos específicos y por
// combustible VIGENTES + número de pedidos visibles. useCartera no expone
// estos contadores, así que se consultan una sola vez aquí, agregados
// (solo cliente_id) y agrupados en Maps. RLS ya limita el resultado a la
// cartera del comercial. Si alguna consulta falla, su Map queda vacío y la
// tarjeta muestra 0 (los badges de n* se omiten si no llegan).
interface ContadoresCartera {
  producto: Map<string, number>;
  combustible: Map<string, number>;
  pedidos: Map<string, number>;
}

export default function Cartera() {
  const insets = useSafeAreaInsets();
  const { perfil } = useAuth();
  const { clientes, cargando, error } = useCartera();
  const [contadores, setContadores] = React.useState<ContadoresCartera | null>(null);

  React.useEffect(() => {
    let cancelado = false;
    void (async () => {
      const hoy = new Date().toISOString().slice(0, 10);
      const vigencia = `fecha_fin.is.null,fecha_fin.gt.${hoy}`;
      const [resProd, resComb, resPed] = await Promise.all([
        supabase
          .from('descuentos_cliente_producto')
          .select('cliente_id')
          .eq('borrado', false)
          .lte('fecha_inicio', hoy)
          .or(vigencia),
        supabase
          .from('descuentos_cliente_combustible')
          .select('cliente_id')
          .eq('borrado', false)
          .lte('fecha_inicio', hoy)
          .or(vigencia),
        supabase.from('pedidos').select('cliente_id').eq('borrado', false),
      ]);
      if (cancelado) return;
      const agrupar = (filas: { cliente_id: string }[] | null) => {
        const mapa = new Map<string, number>();
        for (const f of filas ?? []) {
          mapa.set(f.cliente_id, (mapa.get(f.cliente_id) ?? 0) + 1);
        }
        return mapa;
      };
      setContadores({
        producto: resProd.error
          ? new Map()
          : agrupar(resProd.data as { cliente_id: string }[] | null),
        combustible: resComb.error
          ? new Map()
          : agrupar(resComb.data as { cliente_id: string }[] | null),
        pedidos: resPed.error ? new Map() : agrupar(resPed.data as { cliente_id: string }[] | null),
      });
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
      >
        <View style={{ paddingTop: insets.top + 8 }} className="gap-4 p-4">
          {/* Cabecera (el cierre de sesión vive en la navegación lateral) */}
          <View className="flex-row items-center justify-between">
            <View className="gap-1">
              <Text className="text-xl font-bold tracking-tight">Cartera</Text>
              <Text className="text-xs text-muted-foreground">{perfil?.email}</Text>
            </View>
          </View>

          {/* El admin entra en LECTURA (no gestiona descuentos ni confirma),
              pero puede abrir la ficha de un cliente y crearle una solicitud. */}
          {perfil?.rol === 'admin' ? (
            <View className="rounded-lg border border-primary/40 bg-primary/10 p-3">
              <Text className="text-sm">Vista de solo lectura del comercial</Text>
            </View>
          ) : null}

          {cargando ? (
            <View className="items-center py-16">
              <ActivityIndicator color="hsl(124.3 17.7% 31%)" />
            </View>
          ) : error ? (
            <Text className="text-muted-foreground">{error}</Text>
          ) : clientes.length === 0 ? (
            <Text className="text-muted-foreground">Sin clientes asignados</Text>
          ) : (
            <View className="gap-3">
              {clientes.map((c) => (
                <TarjetaCliente
                  key={c.id}
                  cliente={{
                    ...c,
                    ...(contadores
                      ? {
                          nDescuentosProducto: contadores.producto.get(c.id) ?? 0,
                          nDescuentosCombustible: contadores.combustible.get(c.id) ?? 0,
                        }
                      : {}),
                  }}
                  pedidos={contadores?.pedidos.get(c.id) ?? 0}
                  onPress={() => router.push(`/cartera/${c.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <NavInferior activa="cartera" />
    </>
  );
}
