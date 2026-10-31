import * as React from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';

// Modal de formulario: mismo patrón que ConfirmDialog (overlay oscurecido +
// tarjeta centrada) pero con contenido libre y fila de acciones al pie.
// Usos: "Nuevo comercial", "Nuevo proveedor"... Ancho máximo md, como los
// modales actuales del admin.
export function FormModal({
  visible,
  titulo,
  onCerrar,
  children,
  acciones,
}: {
  visible: boolean;
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
  acciones?: React.ReactNode;
}) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCerrar}>
      <View className="flex-1 items-center justify-center p-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar diálogo"
          className="absolute inset-0 bg-black/50"
          onPress={onCerrar}
        />
        <Card className="w-full max-w-md gap-4 rounded-lg p-4">
          <CardHeader className="px-1">
            <CardTitle accessibilityRole="header" className="text-lg">
              {titulo}
            </CardTitle>
          </CardHeader>
          <View className="gap-2">{children}</View>
          {acciones && <View className="flex-row justify-end gap-2">{acciones}</View>}
        </Card>
      </View>
    </Modal>
  );
}
