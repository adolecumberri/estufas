import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Platform, useColorScheme } from 'react-native';

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
          <Stack screenOptions={{ headerShown: false }} />
          <PortalHost />
        </SolicitudProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
