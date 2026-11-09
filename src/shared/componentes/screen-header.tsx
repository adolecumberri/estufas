import { ChevronLeft } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { AccionCuenta } from '@/shared/componentes/accion-cuenta';
import { Text } from '@/shared/ui/text';
import { volverA } from '@/shared/lib/navegacion';
import { useColoresIcono } from '@/shared/lib/theme';

// Cabecera de pantalla: fila de ALTURA FIJA (h-14) con flecha atrás
// (volverA con respaldo, nunca router.back() suelto) + columna de título +
// zona de acciones anclada a la derecha y centrada verticalmente.
//
// El subtítulo vive DENTRO de la columna del título con numberOfLines={1}:
// por largo que sea, la fila no crece y la zona de acciones no se desplaza
// (feedback 2026-11-10: la burbuja de cuenta no se mueve con subtítulos
// largos). El título también lleva numberOfLines={1}.
//
// La burbuja de cuenta (avatar → hoja con info del usuario, "Mi cuenta" y
// "Cerrar sesión") se renderiza POR DEFECTO y SIEMPRE a la DERECHA de la zona
// de acciones; cualquier `accion` (p. ej. el botón de refresco) va a SU
// IZQUIERDA, de modo que al aparecer no desplaza la burbuja. `sinCuenta` la
// excluye.
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
  return (
    <View className="h-14 flex-row items-center gap-2">
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
      <View className="flex-1 justify-center gap-0.5">
        <Text
          numberOfLines={1}
          accessibilityRole="header"
          className="text-xl font-bold tracking-tight"
        >
          {titulo}
        </Text>
        {/* OJO: `{subtitulo && <Text>}` devuelve `''` cuando subtitulo es '',
            y react-native-web lo rechaza ("Unexpected text node"). Usar ternario. */}
        {subtitulo ? (
          <Text numberOfLines={1} className="text-xs text-muted-foreground">
            {subtitulo}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-center gap-1.5">
        {accion}
        {!sinCuenta && <AccionCuenta />}
      </View>
    </View>
  );
}
