import { Flame } from 'lucide-react-native';
import * as React from 'react';
import { Platform, ScrollView, View } from 'react-native';

import { Chip } from '@/shared/ui/chip';
import type { Categoria } from '@/shared/lib/types';
import { cn } from '@/shared/lib/utils';

type Props = {
  categorias: Categoria[];
  seleccionada: string | null;
  onSeleccionar: (id: string | null) => void;
};

// Fila de chips de categorías con desplazamiento horizontal (diseño Stitch):
// el chip activo lleva acento primario + icono de llama y se deselecciona al
// tocarlo de nuevo. Los chips a mano se sustituyen por la primitiva Chip.
export function ChipsCategorias({ categorias, seleccionada, onSeleccionar }: Props) {
  return (
    <ScrollView
      horizontal
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      className={cn(
        'py-0.5',
        Platform.select({ web: '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden' })
      )}
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      <View className="flex-row items-center gap-2">
        {categorias.map((c) => {
          const activa = seleccionada === c.id;
          return (
            <Chip
              key={c.id}
              etiqueta={c.nombre}
              activo={activa}
              icono={activa ? Flame : undefined}
              onPress={() => onSeleccionar(activa ? null : c.id)}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}
