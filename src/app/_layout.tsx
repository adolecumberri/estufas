import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Platform, useColorScheme, View } from 'react-native';

import { AuthProvider } from '@/contexts/auth-context';
import { SolicitudProvider } from '@/contexts/solicitud-context';
import { NAV_THEME } from '@/lib/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';

  // En web, NativeWind usa la clase .dark en <html>.
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const root = document.documentElement;
    root.classList.toggle('dark', scheme === 'dark');
  }, [scheme]);

  React.useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <AuthProvider>
        <SolicitudProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          {/* Marco del diseño Stitch: en escritorio la app se muestra como una
              columna centrada de ancho móvil (max-w-[430px]) sobre un fondo
              neutro, igual que la maqueta de Google Stitch. En nativo estas
              clases web: no tienen efecto. */}
          <View className="flex-1 web:items-center web:bg-zinc-100 web:dark:bg-zinc-950">
            <View className="relative w-full flex-1 web:max-w-[430px] web:shadow-2xl">
              <Stack screenOptions={{ headerShown: false }} />
              <PortalHost />
            </View>
          </View>
        </SolicitudProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
