import AsyncStorage from '@react-native-async-storage/async-storage';

import { obtenerFiltrosProveedor as obtenerFiltrosProveedorLocal } from '@/features/catalogo/lib/catalogo-local';
import { supabase } from '@/shared/lib/supabase';
import type { Categoria, Combustible } from '@/shared/lib/types';

// ============================================================================
// Filtros del menú lateral POR proveedor (combustibles + categorías) con
// caché de dos niveles (memoria de sesión + AsyncStorage) y TTL.
//
// - Memoria: sirve al instante tras el primer cálculo; es lo que aguanta el
//   spam de cambios de proveedor (10 swaps seguidos no relanzan consultas si
//   el dato ya se calculó).
// - Persistencia: por proveedor, en UNA clave de AsyncStorage (mapa), TTL de
//   10 minutos: un reinicio de la app no vuelve a consultar si el dato es
//   reciente. No se versiona por catálogo: el TTL corto limita la deriva y
//   el snapshot local se regenera al cambiar de versión (ver use-catalogo).
// - Fuente real: SQLite local (snapshot, síncrono) o el RPC
//   fn_filtros_proveedor (0029) en el camino de red.
// ============================================================================

export interface FiltrosProveedor {
  combustibles: Combustible[];
  categorias: Categoria[];
}

const CLAVE_ALMACEN = 'estufas.cache.filtros-proveedor.v1';
const TTL_MS = 10 * 60 * 1000;

interface EntradaCache {
  datos: FiltrosProveedor;
  ts: number;
}

// Fila de categoría que devuelve el RPC fn_filtros_proveedor.
interface CategoriaRpc {
  id: string;
  nombre: string;
  clave: string;
  grupo: string;
  orden: number | null;
  combustible: string | null;
}

const memoria = new Map<string, EntradaCache>();
let persistencia: Record<string, EntradaCache> | null = null;
let lecturaEnCurso: Promise<Record<string, EntradaCache>> | null = null;

const claveDe = (proveedorId: string | null) => proveedorId ?? 'todos';

function esFresca(entrada: EntradaCache | undefined): entrada is EntradaCache {
  return Boolean(entrada && Date.now() - entrada.ts <= TTL_MS);
}

function leerPersistencia(): Promise<Record<string, EntradaCache>> {
  if (persistencia) return Promise.resolve(persistencia);
  if (!lecturaEnCurso) {
    lecturaEnCurso = (async () => {
      try {
        const crudo = await AsyncStorage.getItem(CLAVE_ALMACEN);
        const datos: unknown = crudo ? JSON.parse(crudo) : null;
        persistencia =
          datos && typeof datos === 'object'
            ? (datos as Record<string, EntradaCache>)
            : {};
      } catch {
        // sin persistencia: solo memoria de sesión
        persistencia = {};
      }
      return persistencia;
    })();
  }
  return lecturaEnCurso;
}

function guardar(clave: string, entrada: EntradaCache) {
  memoria.set(clave, entrada);
  void (async () => {
    const todas = await leerPersistencia();
    todas[clave] = entrada;
    try {
      await AsyncStorage.setItem(CLAVE_ALMACEN, JSON.stringify(todas));
    } catch {
      // sin persistencia: la memoria de sesión sigue sirviendo
    }
  })();
}

async function obtenerFiltrosProveedorRed(
  proveedorId: string | null
): Promise<FiltrosProveedor> {
  const { data, error } = await supabase.rpc('fn_filtros_proveedor', {
    p_proveedor: proveedorId ?? null,
  });
  if (error) throw error;
  const fila = (Array.isArray(data) ? data[0] : data) as
    | { combustibles: string[] | null; categorias: CategoriaRpc[] | null }
    | null
    | undefined;

  const combustibles = (fila?.combustibles ?? []).filter(
    (c): c is Combustible => c === 'pellets' || c === 'lena'
  );
  const categorias: Categoria[] = (fila?.categorias ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    clave: c.clave,
    grupo: c.grupo,
    orden: typeof c.orden === 'number' ? c.orden : 0,
    combustible: (c.combustible as Combustible | null) ?? null,
  }));
  return { combustibles, categorias };
}

// Devuelve los filtros del proveedor sirviendo primero las cachés (memoria →
// persistencia) y calculando de la fuente real solo si no hay dato fresco.
// El resultado se re-cachea con write-through en ambos niveles.
export async function obtenerFiltrosProveedorCacheados(
  proveedorId: string | null,
  modoLocal: boolean
): Promise<FiltrosProveedor> {
  const clave = claveDe(proveedorId);

  const enMemoria = memoria.get(clave);
  if (esFresca(enMemoria)) return enMemoria.datos;

  const todas = await leerPersistencia();
  const enDisco = todas[clave];
  if (esFresca(enDisco)) {
    memoria.set(clave, enDisco);
    return enDisco.datos;
  }

  const datos = modoLocal
    ? obtenerFiltrosProveedorLocal(proveedorId)
    : await obtenerFiltrosProveedorRed(proveedorId);
  guardar(clave, { datos, ts: Date.now() });
  return datos;
}
