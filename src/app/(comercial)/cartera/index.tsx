import { router } from 'expo-router';
import { RefreshCw, Users } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { TarjetaCliente } from '@/features/cartera/componentes/tarjeta-cliente';
import { useAuth } from '@/features/auth/use-auth';
import { useCartera } from '@/features/cartera/hooks/use-comercial';
import { EmptyState, ErrorView, LoadingView } from '@/shared/componentes/estados';
import { ScreenScroll } from '@/shared/componentes/screen';
import { ScreenHeader } from '@/shared/componentes/screen-header';
import { NavInferior } from '@/shared/navegacion/nav-inferior';
import { IconButton } from '@/shared/ui';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { supabase } from '@/shared/lib/supabase';

// Resumen por cliente para las tarjetas: descuentos específicos y por
// combustible VIGENTES + número de pedidos visibles. useCartera no expone
// estos contadores, así que se consultan agregados (solo cliente_id) y se
// agrupan en Maps; RLS ya limita el resultado a la cartera del comercial.
// Si alguna consulta falla, su Map queda vacío y la tarjeta muestra 0.
interface ContadoresCartera {
  producto: Map<string, number>;
  combustible: Map<string, number>;
  pedidos: Map<string, number>;
}

export default function Cartera() {
  const { perfil } = useAuth();
  const { clientes, cargando, error, recargar } = useCartera();
  const [contadores, setContadores] = React.useState<ContadoresCartera | null>(null);

  const cargarContadores = React.useCallback(async () => {
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
  }, []);

  React.useEffect(() => {
    void cargarContadores();
  }, [cargarContadores]);

  const refrescar = () => {
    void recargar();
    void cargarContadores();
  };

  return (
    <>
      <ScreenScroll>
        <ScreenHeader
          titulo="Cartera"
          subtitulo={perfil?.email}
          respaldo="/"
          accion={
            <IconButton
              icono={RefreshCw}
              onPress={refrescar}
              etiquetaAccesibilidad="Recargar cartera"
            />
          }
        />

        {/* El admin entra en LECTURA (no gestiona descuentos ni confirma),
            pero puede abrir la ficha de un cliente y crearle una solicitud. */}
        {perfil?.rol === 'admin' ? (
          <Card className="gap-1 rounded-lg border-primary/40 bg-primary/10 p-3">
            <Text className="text-sm">Vista de solo lectura del comercial</Text>
          </Card>
        ) : null}

        {cargando ? (
          <LoadingView />
        ) : error ? (
          <ErrorView mensaje={error} onReintentar={refrescar} />
        ) : clientes.length === 0 ? (
          <EmptyState titulo="Sin clientes" icono={Users} />
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
      </ScreenScroll>

      <NavInferior activa="cartera" />
    </>
  );
}
