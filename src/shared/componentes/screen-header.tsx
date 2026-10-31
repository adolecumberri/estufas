import { ChevronLeft } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/shared/ui/text';
import { volverA } from '@/shared/lib/navegacion';
import { useColoresIcono } from '@/shared/lib/theme';

// Cabecera de pantalla: flecha atrás (volverA con respaldo, nunca
// router.back() suelto) + título + subtítulo opcional + slot derecho para
// acciones. Sustituye los bloques duplicados de admin/* y dev.
export function ScreenHeader({
  titulo,
  subtitulo,
  accion,
  respaldo,
  atras = true,
}: {
  titulo: string;
  subtitulo?: string;
  accion?: React.ReactNode;
  respaldo: string;
  atras?: boolean;
}) {
  const colores = useColoresIcono();
  return (
    <View className="flex-row items-center gap-2">
      {atras && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => volverA(respaldo)}
          className="rounded-md p-1 active:bg-accent"
        >
          <ChevronLeft size={24} color={colores.primerPlano} />
        </Pressable>
      )}
      <View className="flex-1 gap-0.5">
        <Text accessibilityRole="header" className="text-xl font-bold tracking-tight">
          {titulo}
        </Text>
        {subtitulo && <Text className="text-xs text-muted-foreground">{subtitulo}</Text>}
      </View>
      {accion}
    </View>
  );
}
