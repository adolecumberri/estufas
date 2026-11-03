import { useColorScheme } from 'react-native';

import { DarkTheme, DefaultTheme } from 'expo-router';

// Tema de la app: escala de grises (zinc) + un único acento ámbar.
export const THEME = {
  light: {
    background: 'hsl(0 0% 100%)',
    foreground: 'hsl(240 10% 3.9%)',
    card: 'hsl(0 0% 100%)',
    cardForeground: 'hsl(240 10% 3.9%)',
    popover: 'hsl(0 0% 100%)',
    popoverForeground: 'hsl(240 10% 3.9%)',
    primary: 'hsl(124.3 17.7% 31%)',
    primaryForeground: 'hsl(0 0% 98%)',
    secondary: 'hsl(240 4.8% 95.9%)',
    secondaryForeground: 'hsl(240 5.9% 10%)',
    muted: 'hsl(240 4.8% 95.9%)',
    mutedForeground: 'hsl(240 3.8% 46.1%)',
    accent: 'hsl(240 4.8% 95.9%)',
    accentForeground: 'hsl(240 5.9% 10%)',
    destructive: 'hsl(0 84.2% 60.2%)',
    border: 'hsl(240 5.9% 90%)',
    input: 'hsl(240 5.9% 90%)',
    ring: 'hsl(124.3 17.7% 31%)',
    radius: '0.625rem',
  },
  dark: {
    background: 'hsl(240 10% 3.9%)',
    foreground: 'hsl(0 0% 98%)',
    card: 'hsl(240 10% 3.9%)',
    cardForeground: 'hsl(0 0% 98%)',
    popover: 'hsl(240 10% 3.9%)',
    popoverForeground: 'hsl(0 0% 98%)',
    primary: 'hsl(124.3 17.7% 31%)',
    primaryForeground: 'hsl(0 0% 98%)',
    secondary: 'hsl(240 3.7% 15.9%)',
    secondaryForeground: 'hsl(0 0% 98%)',
    muted: 'hsl(240 3.7% 15.9%)',
    mutedForeground: 'hsl(240 5% 64.9%)',
    accent: 'hsl(240 3.7% 15.9%)',
    accentForeground: 'hsl(0 0% 98%)',
    destructive: 'hsl(0 72.2% 50.6%)',
    border: 'hsl(240 3.7% 15.9%)',
    input: 'hsl(240 3.7% 15.9%)',
    ring: 'hsl(124.3 17.7% 31%)',
    radius: '0.625rem',
  },
} as const;

export const NAV_THEME: Record<'light' | 'dark', typeof DefaultTheme> = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: THEME.light.primary,
      background: THEME.light.background,
      card: THEME.light.card,
      text: THEME.light.foreground,
      border: THEME.light.border,
      notification: THEME.light.destructive,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: THEME.dark.primary,
      background: THEME.dark.background,
      card: THEME.dark.card,
      text: THEME.dark.foreground,
      border: THEME.dark.border,
      notification: THEME.dark.destructive,
    },
  },
};

// Colores explícitos para iconos lucide: react-native-svg resuelve
// "currentColor" a negro en nativo, así que los iconos reciben color
// explícito según el tema (los tokens de clase no llegan al stroke del SVG).
export const COLORES_ICONO = {
  light: {
    primario: '#415D43',
    primarioClaro: '#fafafa',
    primerPlano: '#09090b',
    tenue: '#71717a',
    destructivo: '#dc2626',
  },
  dark: {
    primario: '#415D43',
    primarioClaro: '#fafafa',
    primerPlano: '#fafafa',
    tenue: '#a1a1aa',
    destructivo: '#ef4444',
  },
} as const;

export function useColoresIcono() {
  return useColorScheme() === 'dark' ? COLORES_ICONO.dark : COLORES_ICONO.light;
}
