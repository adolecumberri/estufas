import * as React from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';

// Diálogo de confirmación ("¿Seguro que quieres…?"): Modal con overlay
// oscurecido (tocar fuera = cancelar) y tarjeta centrada. `destructivo`
// pinta el botón de confirmar en rojo (borrados, anulaciones...).
export function ConfirmDialog({
  visible,
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  destructivo,
  onConfirmar,
  onCancelar,
}: {
  visible: boolean;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  destructivo?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancelar}>
      <View className="flex-1 items-center justify-center p-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar diálogo"
          className="absolute inset-0 bg-black/50"
          onPress={onCancelar}
        />
        <Card className="w-full max-w-sm gap-4 rounded-lg p-4">
          <CardHeader className="gap-1 px-1">
            <CardTitle accessibilityRole="header" className="text-lg">
              {titulo}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-1">
            <Text className="text-sm text-muted-foreground">{mensaje}</Text>
          </CardContent>
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onPress={onCancelar}>
              <Text>{textoCancelar}</Text>
            </Button>
            <Button variant={destructivo ? 'destructive' : 'default'} size="sm" onPress={onConfirmar}>
              <Text>{textoConfirmar}</Text>
            </Button>
          </View>
        </Card>
      </View>
    </Modal>
  );
}
