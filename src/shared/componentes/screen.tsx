import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/shared/lib/utils';

// Pantalla base: contenedor con fondo y safe area superior. Toda pantalla
// debería arrancar aquí en vez de repetir `View flex-1 bg-background` +
// `paddingTop: insets.top`. `padded` añade el padding horizontal estándar.
export function Screen({
  children,
  className,
  padded = false,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className={cn('flex-1 bg-background', padded && 'px-4', className)}
      style={{ paddingTop: insets.top }}
    >
      {children}
    </View>
  );
}

// Variante con scroll: mismo fondo/safe area que Screen más un ScrollView con
// padding inferior generoso (no lo tapa la barra de navegación) y teclado que
// no se cierra al tocar fuera (imprescindible en formularios).
export function ScreenScroll({
  children,
  contentClassName,
}: {
  children: React.ReactNode;
  contentClassName?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      className="flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
    >
      <View style={{ paddingTop: insets.top + 8 }} className={cn('gap-4 p-4', contentClassName)}>
        {children}
      </View>
    </ScrollView>
  );
}
