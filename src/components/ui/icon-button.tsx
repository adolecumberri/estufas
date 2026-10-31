import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable } from 'react-native';

import { useColoresIcono } from '@/lib/theme';
import { cn } from '@/lib/utils';

// Botón solo-icono (chevrones, cierres, −/+...). `ghost` sin fondo (activo
// bg-accent); `outline` con borde. hitSlop 8 para un área de toque cómoda.
export function IconButton({
  icono: Icono,
  onPress,
  etiquetaAccesibilidad,
  variante = 'ghost',
  tamano = 20,
}: {
  icono: LucideIcon;
  onPress: () => void;
  etiquetaAccesibilidad: string;
  variante?: 'ghost' | 'outline';
  tamano?: 16 | 18 | 20 | 24;
}) {
  const colores = useColoresIcono();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesibilidad}
      hitSlop={8}
      onPress={onPress}
      className={cn(
        'items-center justify-center rounded-md p-1',
        variante === 'ghost' && 'active:bg-accent',
        variante === 'outline' && 'border border-border active:bg-accent'
      )}
    >
      <Icono size={tamano} color={colores.primerPlano} />
    </Pressable>
  );
}
