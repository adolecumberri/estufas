import { ChevronLeft } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { AccionCuenta } from '@/shared/componentes/accion-cuenta';
import { Text } from '@/shared/ui/text';
import { volverA } from '@/shared/lib/navegacion';
import { useColoresIcono } from '@/shared/lib/theme';

// Cabecera de pantalla: flecha atrás (volverA con respaldo, nunca
// router.back() suelto) + título + subtítulo opcional + slot derecho.
//
// El slot derecho trae POR DEFECTO la acción de cuenta (avatar → hoja con
// info del usuario, "Mi cuenta" y "Cerrar sesión"): toda pantalla que use
// ScreenHeader tiene acceso a la cuenta sin montarla a mano. Se sustituye
// pasando `accion` (p. ej. "Nuevo comercial" — el header añade la cuenta al
// lado) y se excluye con `sinCuenta`.
export function ScreenHeader({
  titulo,
  subtitulo,
  accion,
  respaldo,
  atras = true,
  sinCuenta = false,
}: {
  titulo: string;
  subtitulo?: string;
  accion?: React.ReactNode;
  respaldo: string;
  atras?: boolean;
  sinCuenta?: boolean;
}) {
  const colores = useColoresIcono();
  // Si se pasa `accion`, va la cuenta delante (acceso siempre visible) y el
  // contenido del slot detrás; `sinCuenta` la elimina del todo.
  const slotDerecho = sinCuenta ? (accion ?? null) : (
    <View className="flex-row items-center gap-1.5">
      <AccionCuenta />
      {accion}
    </View>
  );
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
        {/* OJO: `{subtitulo && <Text>}` devuelve `''` cuando subtitulo es '',
            y react-native-web lo rechaza ("Unexpected text node"). Usar ternario. */}
        {subtitulo ? <Text className="text-xs text-muted-foreground">{subtitulo}</Text> : null}
      </View>
      {slotDerecho}
    </View>
  );
}
