import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Badge } from '@/shared/ui/badge';
import { Card, CardContent } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { TIPOS_CLIENTE } from '@/shared/constantes';
import { formatPct } from '@/shared/lib/format';
import { useColoresIcono } from '@/shared/lib/theme';
import type { PerfilUsuario } from '@/shared/lib/types';

// Datos mínimos de un cliente para la tarjeta: perfil + resumen de condiciones
// comerciales (los contadores de descuentos específicos son opcionales).
export interface ClienteTarjetaDatos extends PerfilUsuario {
  descuento_porcentaje: number;
  nDescuentosProducto?: number;
  nDescuentosCombustible?: number;
}

interface TarjetaClienteProps {
  cliente: ClienteTarjetaDatos;
  pedidos?: number;
  onPress: () => void;
}

// Tarjeta reutilizable de cliente para la cartera (y donde haga falta):
// nombre/razón social + email, tipo de cliente, resumen de descuentos y
// número de pedidos. Toda la tarjeta es un Pressable.
export function TarjetaCliente({ cliente, pedidos, onPress }: TarjetaClienteProps) {
  const colores = useColoresIcono();

  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <Card className="rounded-lg">
        <CardContent className="gap-2">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1 gap-0.5">
              <Text className="font-medium" numberOfLines={1}>
                {cliente.razon_social ?? `${cliente.nombre} ${cliente.apellidos ?? ''}`.trim()}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {cliente.email}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              {cliente.tipo_cliente ? (
                <Badge variant="outline">
                  <Text>{TIPOS_CLIENTE[cliente.tipo_cliente].etiqueta}</Text>
                </Badge>
              ) : null}
              <ChevronRight size={18} color={colores.tenue} />
            </View>
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            <Badge variant="outline">
              <Text>
                {cliente.descuento_porcentaje > 0
                  ? `General ${formatPct(cliente.descuento_porcentaje)}`
                  : 'Sin descuento general'}
              </Text>
            </Badge>
            {cliente.nDescuentosProducto !== undefined ? (
              <Badge variant="outline">
                <Text>
                  #{cliente.nDescuentosProducto}{' '}
                  {cliente.nDescuentosProducto === 1 ? 'producto' : 'productos'}
                </Text>
              </Badge>
            ) : null}
            {cliente.nDescuentosCombustible !== undefined ? (
              <Badge variant="outline">
                <Text>
                  #{cliente.nDescuentosCombustible}{' '}
                  {cliente.nDescuentosCombustible === 1 ? 'combustible' : 'combustibles'}
                </Text>
              </Badge>
            ) : null}
            {pedidos != null ? (
              <Badge variant="outline">
                <Text>
                  {pedidos} {pedidos === 1 ? 'pedido' : 'pedidos'}
                </Text>
              </Badge>
            ) : null}
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
}
