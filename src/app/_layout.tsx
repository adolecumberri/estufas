import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as React from 'react';
import { Platform, useColorScheme, View } from 'react-native';

import { AuthProvider } from '@/contexts/auth-context';
import { ProveedorActivoProvider } from '@/contexts/proveedor-activo-context';
import { SolicitudProvider } from '@/contexts/solicitud-context';
import { NAV_THEME } from '@/lib/theme';

void SplashScreen.preventAutoHideAsync();

// Contenido raíz. El primario global es el VERDE por defecto de la app
// (--primary en global.css); el color del proveedor activo se aplica solo en
// las vistas relacionadas con proveedores (p. ej. el catálogo), no aquí.
function ContenidoRaiz({ scheme }: { scheme: 'light' | 'dark' }) {
  return (
    <>
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
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';

  // En web, NativeWind usa la clase .dark en <html>.
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const root = document.documentElement;
    root.classList.toggle('dark', scheme === 'dark');
  }, [scheme]);

  // El fondo de la ventana debe seguir al tema: en Android, durante las
  // transiciones (p. ej. el gesto lateral de volver) se ve el fondo de la
  // ventana detrás de la pantalla; blanco en modo oscuro provoca un destello.
  React.useEffect(() => {
    void SystemUI.setBackgroundColorAsync(scheme === 'dark' ? '#09090b' : '#ffffff');
  }, [scheme]);

  React.useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <AuthProvider>
        <SolicitudProvider>
          <ProveedorActivoProvider>
            <ContenidoRaiz scheme={scheme} />
          </ProveedorActivoProvider>
        </SolicitudProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
