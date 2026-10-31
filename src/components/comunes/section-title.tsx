import * as React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

// Título de sección: fila con título compacto y slot derecho para acciones
// (contador, enlace, botón...). Sustituye los `text-sm font-semibold` sueltos
// de los listados.
export function SectionTitle({
  children,
  accion,
}: {
  children: React.ReactNode;
  accion?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text className="text-sm font-semibold tracking-tight">{children}</Text>
      {accion}
    </View>
  );
}
