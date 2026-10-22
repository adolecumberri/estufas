import { Flame } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useColoresIcono } from '@/lib/theme';
import type { Categoria } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
  categorias: Categoria[];
  seleccionada: string | null;
  onSeleccionar: (id: string | null) => void;
};

// Fila de chips de categorías con desplazamiento horizontal (diseño Stitch):
// el chip activo lleva acento ámbar + icono de llama y se deselecciona al
// tocarlo de nuevo.
export function ChipsCategorias({ categorias, seleccionada, onSeleccionar }: Props) {
  const colores = useColoresIcono();
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
            <Pressable
              key={c.id}
              onPress={() => onSeleccionar(activa ? null : c.id)}
              className={cn(
                'flex-row items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 active:scale-95',
                activa ? 'bg-primary' : 'border border-border bg-background'
              )}
            >
              {activa && <Flame size={16} color={colores.primarioClaro} />}
              <Text
                className={cn(
                  'text-sm font-medium',
                  activa ? 'text-primary-foreground' : 'text-foreground'
                )}
              >
                {c.nombre}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
