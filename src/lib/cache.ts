import AsyncStorage from '@react-native-async-storage/async-storage';

// Caché local en AsyncStorage con entradas { dato, ts } para patrones
// stale-while-revalidate: los datos se pintan al instante desde caché y la
// red revalida en segundo plano. Los errores de almacenamiento se ignoran
// (la caché es un acelerador, no una fuente de verdad).

export interface EntradaCache {
  dato: unknown;
  ts: number;
}

export async function cacheLeer<T>(clave: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(clave);
    if (!raw) return null;
    const e: unknown = JSON.parse(raw);
    if (typeof e !== 'object' || e === null || Array.isArray(e) || !('dato' in e)) return null;
    return (e as EntradaCache).dato as T;
  } catch {
    return null;
  }
}

export async function cacheEscribir<T>(clave: string, dato: T): Promise<void> {
  try {
    await AsyncStorage.setItem(clave, JSON.stringify({ dato, ts: Date.now() } satisfies EntradaCache));
  } catch {
    // sin almacenamiento disponible
  }
}

// Edad de la entrada en ms, o null si no existe / no se puede leer.
export async function cacheEdad(clave: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(clave);
    if (!raw) return null;
    const e = JSON.parse(raw) as EntradaCache;
    return Date.now() - e.ts;
  } catch {
    return null;
  }
}
