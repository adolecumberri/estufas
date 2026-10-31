import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { cn } from '@/shared/lib/utils';

// Tarjeta de fila presionable para listados (clientes, pedidos...): Card
// compacto con feedback al tocar. Sin onPress se usa como tarjeta estática.
export function ListCard({
  children,
  onPress,
  className,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
}) {
  const tarjeta = <Card className={cn('gap-1 rounded-lg p-3', className)}>{children}</Card>;
  if (!onPress) return tarjeta;
  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      {tarjeta}
    </Pressable>
  );
}

// Fila clave/valor dentro de tarjetas de detalle (etiqueta xs muted a la
// izquierda, valor sm a la derecha).
export function FilaDetalle({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text className="text-xs text-muted-foreground">{etiqueta}</Text>
      <Text className="text-sm">{valor}</Text>
    </View>
  );
}
