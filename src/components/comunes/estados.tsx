import { AlertCircle, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useColoresIcono } from '@/lib/theme';

// Estados transversales de pantalla (contrato: cargando → error → vacío →
// datos). Sustituyen los ActivityIndicator + Text sueltos y los vacíos hechos
// a mano; toda pantalla debería cubrir sus cuatro estados con estas piezas.

// Cargando: spinner con el primario del tema + texto opcional.
export function LoadingView({ texto }: { texto?: string }) {
  const colores = useColoresIcono();
  return (
    <View className="flex-1 items-center justify-center gap-2 py-16">
      <ActivityIndicator color={colores.primario} />
      {texto ? <Text className="text-sm text-muted-foreground">{texto}</Text> : null}
    </View>
  );
}

// Error: icono destructivo + mensaje + botón "Reintentar" opcional.
export function ErrorView({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar?: () => void;
}) {
  const colores = useColoresIcono();
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <AlertCircle size={32} color={colores.destructivo} />
      <Text className="text-center text-sm text-muted-foreground">{mensaje}</Text>
      {onReintentar && (
        <Button variant="outline" size="sm" onPress={onReintentar}>
          <Text>Reintentar</Text>
        </Button>
      )}
    </View>
  );
}

// Vacío: icono tenue + título + descripción + acción opcional (p. ej. "Ver
// catálogo").
export function EmptyState({
  titulo,
  descripcion,
  icono: Icono,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  icono?: LucideIcon;
  accion?: React.ReactNode;
}) {
  const colores = useColoresIcono();
  return (
    <View className="flex-1 items-center justify-center gap-2 px-8 py-16">
      {Icono && <Icono size={32} color={colores.tenue} />}
      <Text className="text-center font-medium">{titulo}</Text>
      {descripcion && (
        <Text className="text-center text-sm text-muted-foreground">{descripcion}</Text>
      )}
      {accion}
    </View>
  );
}
