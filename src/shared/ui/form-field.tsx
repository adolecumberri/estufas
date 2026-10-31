import * as React from 'react';
import { View } from 'react-native';

import { Label } from '@/shared/ui/label';
import { Text } from '@/shared/ui/text';

// Campo de formulario: etiqueta (con asterisco si es requerido) + control
// hijo + mensaje de error consistente (xs destructivo). Sustituye los
// Label + Input + error hechos a mano de acceso/registro/admin.
export function FormField({
  etiqueta,
  requerido = false,
  error,
  children,
}: {
  etiqueta: string;
  requerido?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Label>
        {etiqueta}
        {requerido && <Text className="text-destructive"> *</Text>}
      </Label>
      {children}
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
    </View>
  );
}
