import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { SUPABASE } from '@/constants';

// En el prerender estático de web no existe `window`: se usa un almacén vacío
// para que la carga de sesión no reviente en el servidor. En cliente (web y
// nativo) se usa AsyncStorage.
const sinAlmacen = {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
};

const esServidorWeb = Platform.OS === 'web' && typeof window === 'undefined';

// Cliente único de Supabase (REST/PostgREST). RLS decide qué ve cada usuario.
export const supabase = createClient(SUPABASE.url, SUPABASE.anonKey, {
  auth: {
    storage: esServidorWeb ? sinAlmacen : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
