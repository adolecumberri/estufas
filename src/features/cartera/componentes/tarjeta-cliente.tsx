import { ChevronRight, Copy } from 'lucide-react-native';
import { Share, View } from 'react-native';

import { ListCard } from '@/shared/componentes/list-card';
import { IconButton } from '@/shared/ui';
import { Badge } from '@/shared/ui/badge';
import { Text } from '@/shared/ui/text';
import { TIPOS_CLIENTE } from '@/shared/constantes';
import { formatPct } from '@/shared/lib/format';
import { useColoresIcono } from '@/shared/lib/theme';
import type { PerfilUsuario } from '@/shared/lib/types';

// Datos mínimos de un cliente para la tarjeta: perfil + descuento general.
export interface ClienteTarjetaDatos extends PerfilUsuario {
  descuento_porcentaje: number;
}

// Resumen legible de descuentos (REQUISITOS_FICHA_CLIENTE §A.3-4): total por
// nivel + las reglas agrupadas por proveedor (nombre y nº de reglas).
export interface ResumenDescuentosCliente {
  proveedor: number;
  categoria: number;
  producto: number;
  proveedores: { nombre: string; nReglas: number }[];
}

interface TarjetaClienteProps {
  cliente: ClienteTarjetaDatos;
  resumen?: ResumenDescuentosCliente;
  pedidos?: number;
  onPress: () => void;
}

// Tarjeta reutilizable de cliente (cartera del comercial y vista del admin):
// nombre con el descuento general al lado, email copiable (hoja de compartir
// del sistema + texto seleccionable — expo-clipboard NO está instalado y no
// se añaden dependencias), resumen "Descuentos" legible y nº de pedidos.
// Toda la tarjeta es un Pressable de navegación.
export function TarjetaCliente({ cliente, resumen, pedidos, onPress }: TarjetaClienteProps) {
  const colores = useColoresIcono();

  const total = resumen ? resumen.proveedor + resumen.categoria + resumen.producto : 0;
  const tipos = [
    resumen?.proveedor ? 'proveedor' : null,
    resumen?.categoria ? 'categoría' : null,
    resumen?.producto ? 'producto' : null,
  ].filter((t): t is string => t !== null);
  const resumenTexto = !resumen
    ? null
    : total === 0
      ? 'Sin descuentos'
      : `${total} ${total === 1 ? 'descuento' : 'descuentos'} · ${tipos.join(' + ')}`;

  const copiarEmail = () => {
    void Share.share({ message: cliente.email });
  };

  return (
    <ListCard onPress={onPress}>
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Text className="font-medium" numberOfLines={1}>
              {cliente.razon_social ?? `${cliente.nombre} ${cliente.apellidos ?? ''}`.trim()}
            </Text>
            {cliente.descuento_porcentaje > 0 ? (
              <Text className="text-xs font-medium text-primary">
                General {formatPct(cliente.descuento_porcentaje)}
              </Text>
            ) : null}
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1} selectable>
              {cliente.email}
            </Text>
            <IconButton
              icono={Copy}
              onPress={copiarEmail}
              etiquetaAccesibilidad={`Copiar email de ${cliente.email}`}
              tamano={16}
            />
          </View>
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

      {resumen ? (
        <View className="gap-1">
          <Text className="text-xs font-semibold text-muted-foreground">Descuentos</Text>
          <Text className="text-xs">{resumenTexto}</Text>
          {resumen.proveedores.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {resumen.proveedores.map((p) => (
                <Badge key={p.nombre} variant="outline">
                  <Text>
                    {p.nombre} · {p.nReglas} {p.nReglas === 1 ? 'regla' : 'reglas'}
                  </Text>
                </Badge>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {pedidos != null ? (
        <Badge variant="outline" className="self-start">
          <Text>
            {pedidos} {pedidos === 1 ? 'pedido' : 'pedidos'}
          </Text>
        </Badge>
      ) : null}
    </ListCard>
  );
}
