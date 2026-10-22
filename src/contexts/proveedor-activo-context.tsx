import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { Proveedor } from '@/lib/types';

// ============================================================================
// Proveedor activo: la lista de proveedores visibles para la cuenta (RPC
// fn_proveedores_visibles según rol; anónimo → todos los activos) y la
// selección persistida por cuenta en AsyncStorage. El proveedor activo tiñe
// el primario de toda la app (ver _layout.tsx).
// ============================================================================

interface ProveedorActivoContextValue {
  proveedores: Proveedor[];
  activo: Proveedor | null;
  setActivo: (id: string) => void;
  cargando: boolean;
}

const ProveedorActivoContext = React.createContext<ProveedorActivoContextValue | null>(null);

const CLAVE_BASE = 'estufas.proveedor.v1';

export function ProveedorActivoProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const uid = session?.user?.id ?? null;
  // La selección se aísla por cuenta (o 'anon'): en dispositivos compartidos
  // cada usuario conserva su propio proveedor activo.
  const claveAlmacen = `${CLAVE_BASE}.${uid ?? 'anon'}`;

  const [proveedores, setProveedores] = React.useState<Proveedor[]>([]);
  const [activo, setActivoState] = React.useState<Proveedor | null>(null);
  const [cargando, setCargando] = React.useState(true);

  // Carga la lista al montar y al cambiar de cuenta (la lista depende del rol
  // y del comercial asignado; nunca se muestra la de la cuenta anterior).
  React.useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setProveedores([]);
    setActivoState(null);

    void (async () => {
      let guardado: string | null = null;
      try {
        guardado = await AsyncStorage.getItem(claveAlmacen);
      } catch {
        // sin almacenamiento: se usará el primero de la lista
      }
      const { data } = await supabase.rpc('fn_proveedores_visibles');
      if (cancelado) return;
      const lista = (data ?? []) as Proveedor[];
      setProveedores(lista);
      // El id guardado se usa solo si sigue en la lista; si no (o sin dato
      // guardado) se elige el PRIMERO.
      const elegido = lista.find((p) => p.id === guardado) ?? lista[0] ?? null;
      setActivoState(elegido);
      setCargando(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [uid, claveAlmacen]);

  // Cambia el proveedor activo y persiste el id. Si el id no está en la
  // lista se ignora (nada que seleccionar).
  const setActivo = React.useCallback(
    (id: string) => {
      const elegido = proveedores.find((p) => p.id === id);
      if (!elegido) return;
      setActivoState(elegido);
      void AsyncStorage.setItem(claveAlmacen, id).catch(() => {
        // sin almacenamiento: la selección solo dura la sesión
      });
    },
    [proveedores, claveAlmacen]
  );

  const value = React.useMemo(
    () => ({ proveedores, activo, setActivo, cargando }),
    [proveedores, activo, setActivo, cargando]
  );

  return <ProveedorActivoContext.Provider value={value}>{children}</ProveedorActivoContext.Provider>;
}

export function useProveedorActivo(): ProveedorActivoContextValue {
  const ctx = React.useContext(ProveedorActivoContext);
  if (!ctx) throw new Error('useProveedorActivo debe usarse dentro de <ProveedorActivoProvider>');
  return ctx;
}
