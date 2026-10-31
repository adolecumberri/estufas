import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { useColoresIcono } from '@/shared/lib/theme';

// Tarjeta de métrica (cartera, pedidos, panel admin): icono con acento +
// valor grande + etiqueta discreta. Para resúmenes de una cifra.
export function StatCard({
  etiqueta,
  valor,
  icono: Icono,
  acento = 'primary',
}: {
  etiqueta: string;
  valor: string;
  icono?: LucideIcon;
  acento?: 'primary' | 'destructivo' | 'tenue';
}) {
  const colores = useColoresIcono();
  const colorIcono =
    acento === 'destructivo'
      ? colores.destructivo
      : acento === 'tenue'
        ? colores.tenue
        : colores.primario;
  return (
    <Card className="flex-1 gap-1.5 rounded-lg p-3">
      <View className="flex-row items-center gap-1.5">
        {Icono && <Icono size={18} color={colorIcono} />}
        <Text className="text-xs text-muted-foreground">{etiqueta}</Text>
      </View>
      <Text className="text-xl font-bold tracking-tight">{valor}</Text>
    </Card>
  );
}
