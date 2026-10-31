import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable } from 'react-native';

import { Text } from '@/shared/ui/text';
import { useColoresIcono } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

// Pastilla presionable para filtros y selecciones rápidas (Badge es solo de
// vista). Activa → acento primario; inactiva → superficie muted. Sin onPress
// se renderiza como pastilla estática.
export function Chip({
  etiqueta,
  activo = false,
  onPress,
  icono: Icono,
}: {
  etiqueta: string;
  activo?: boolean;
  onPress?: () => void;
  icono?: LucideIcon;
}) {
  const colores = useColoresIcono();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      className={cn(
        'flex-row items-center gap-1.5 rounded-full px-3 py-1.5',
        activo ? 'bg-primary' : 'bg-muted'
      )}
    >
      {Icono && <Icono size={14} color={activo ? colores.primarioClaro : colores.tenue} />}
      <Text
        className={cn(
          'text-xs font-medium',
          activo ? 'text-primary-foreground' : 'text-muted-foreground'
        )}
      >
        {etiqueta}
      </Text>
    </Pressable>
  );
}
