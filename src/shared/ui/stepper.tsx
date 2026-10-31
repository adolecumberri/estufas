import { Minus, Plus } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { IconButton } from '@/shared/ui/icon-button';
import { Text } from '@/shared/ui/text';
import { cn } from '@/shared/lib/utils';

// Stepper de cantidad (− valor +) para carrito/ficha de producto. No baja de
// `min` (1 por defecto); `deshabilitado` bloquea ambos botones y atenúa el
// control.
export function StepperCantidad({
  valor,
  onCambiar,
  min = 1,
  deshabilitado = false,
}: {
  valor: number;
  onCambiar: (nuevo: number) => void;
  min?: number;
  deshabilitado?: boolean;
}) {
  const restar = () => {
    if (deshabilitado) return;
    onCambiar(Math.max(min, valor - 1));
  };
  const sumar = () => {
    if (deshabilitado) return;
    onCambiar(valor + 1);
  };
  return (
    <View
      className={cn(
        'flex-row items-center rounded-[10px] border border-border',
        deshabilitado && 'opacity-50'
      )}
    >
      <IconButton icono={Minus} onPress={restar} etiquetaAccesibilidad="Reducir cantidad" tamano={16} />
      <Text className="w-8 text-center text-sm font-semibold">{valor}</Text>
      <IconButton icono={Plus} onPress={sumar} etiquetaAccesibilidad="Aumentar cantidad" tamano={16} />
    </View>
  );
}
