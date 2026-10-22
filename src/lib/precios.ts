import { cacheEdad, cacheEscribir, cacheLeer } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import type { Combustible, DescuentosCuenta, OrigenDescuento } from '@/lib/types';

// ============================================================================
// Reglas de precios del cliente (réplica local del servidor, fn_calcular_precio
// de supabase/migrations/0006_descuentos_combustible.sql).
//
// Precedencia del servidor (0006, comentario de la función):
//   producto > combustible > general > promoción (la promoción gana si es
//   MAYOR que el candidato anterior; los descuentos no se acumulan).
// ============================================================================

export interface ReglasCuenta {
  /** Descuento general del cliente (usuarios.descuento_porcentaje). */
  general_pct: number | null;
  /** Descuento específico por producto (producto_id → pct). */
  productos: Map<string, number>;
  /** Descuento por combustible (combustible → pct). */
  combustibles: Map<string, number>;
  /** Promoción de tienda vigente (la mejor, ya agregada por el servidor). */
  promo_pct: number | null;
  /** Proveedores habilitados para el comercial efectivo de esta cuenta. */
  proveedores_habilitados: string[];
}

// Mínimo del producto que necesita la regla de precios.
export interface ProductoParaPrecio {
  producto_id: string;
  combustibles: Combustible[];
}

export interface ResultadoPrecio {
  precio_final: number;
  descuento_pct: number;
  descuento_origen: OrigenDescuento;
}

const CLAVE_REGLAS = 'estufas.cache.reglas.v1';
const TTL_REGLAS_MS = 5 * 60 * 1000; // 5 minutos por cuenta (offline friendly)

const claveReglas = (uid: string | null, clienteId: string | null | undefined) =>
  `${CLAVE_REGLAS}:${uid ?? 'anon'}:${clienteId ?? 'propia'}`;

// Convierte el resultado del RPC fn_descuentos_cuenta en las reglas locales.
function aReglas(datos: DescuentosCuenta | null | undefined): ReglasCuenta | null {
  if (!datos) return null;
  return {
    general_pct: typeof datos.general_pct === 'number' ? datos.general_pct : null,
    productos: new Map((datos.productos ?? []).map((d) => [d.producto_id, d.pct])),
    combustibles: new Map((datos.combustibles ?? []).map((d) => [d.combustible, d.pct])),
    promo_pct: typeof datos.promo_pct === 'number' ? datos.promo_pct : null,
    proveedores_habilitados: Array.isArray(datos.proveedores_habilitados)
      ? datos.proveedores_habilitados
      : [],
  };
}

// Carga las reglas de la cuenta efectiva (fn_descuentos_cuenta) con caché de
// 5 minutos por cuenta en AsyncStorage para funcionar sin red. Devuelve null
// si no hay cuenta (anónimo: precios base) o si la consulta falla sin caché.
export async function obtenerReglasCuenta(
  uid: string | null,
  clienteId: string | null | undefined
): Promise<ReglasCuenta | null> {
  if (!uid) return null; // anónimo: sin reglas (precio base)
  const clave = claveReglas(uid, clienteId);
  // En la caché se guarda el DTO plano del RPC (JSON serializable); los Map
  // de ReglasCuenta no sobreviven a JSON.stringify y se reconstruyen al leer.
  const enCache = await cacheLeer<DescuentosCuenta>(clave);
  const edad = await cacheEdad(clave);
  const vigente = enCache && edad !== null && edad <= TTL_REGLAS_MS;
  if (vigente && enCache) return aReglas(enCache);

  try {
    const { data, error } = await supabase.rpc('fn_descuentos_cuenta', {
      p_cliente: clienteId ?? null,
    });
    if (error || !data) {
      // Red caída o sin permiso: se devuelve la caché caducada si existe.
      return enCache ? aReglas(enCache) : null;
    }
    const dto = data as DescuentosCuenta;
    void cacheEscribir(clave, dto);
    return aReglas(dto);
  } catch {
    return enCache ? aReglas(enCache) : null;
  }
}

// Aplica las reglas de cuenta a un producto replicando fn_calcular_precio
// (0006): candidato = producto ?? combustible (mejor entre los combustibles
// del producto) ?? general (>0) ?? 0; final = MAX(candidato, promo).
// Origen: cliente_producto | cliente_combustible | cliente_general |
// promocion_tienda | ninguno, con la MISMA semántica que el servidor.
export function aplicarReglas(
  reglas: ReglasCuenta | null,
  producto: ProductoParaPrecio
): { descuento_pct: number; descuento_origen: OrigenDescuento } {
  if (!reglas) return { descuento_pct: 0, descuento_origen: 'ninguno' };

  let pct = 0;
  let origen: OrigenDescuento = 'ninguno';

  const especifico = reglas.productos.get(producto.producto_id);
  if (especifico !== undefined && especifico !== null) {
    pct = especifico;
    origen = 'cliente_producto';
  } else {
    // Combustible: el servidor toma la primera categoría con combustible;
    // localmente se toma el MEJOR descuento entre los combustibles del
    // producto (el snapshot trae combustibles[] ya resueltos).
    let mejorCombustible: number | null = null;
    for (const c of producto.combustibles) {
      const d = reglas.combustibles.get(c);
      if (d !== undefined && d !== null && (mejorCombustible === null || d > mejorCombustible)) {
        mejorCombustible = d;
      }
    }
    if (mejorCombustible !== null) {
      pct = mejorCombustible;
      origen = 'cliente_combustible';
    } else if (reglas.general_pct !== null && reglas.general_pct > 0) {
      pct = reglas.general_pct;
      origen = 'cliente_general';
    }
  }

  // Promoción: gana solo si supera el candidato (no se acumula).
  const promo = reglas.promo_pct ?? 0;
  if (promo > pct) {
    pct = promo;
    origen = 'promocion_tienda';
  }

  return { descuento_pct: pct, descuento_origen: origen };
}

// Precio final replicando round(precio_base * (1 - pct/100), 2) del servidor.
export function calcularPrecioFinal(
  precio_base: number,
  reglas: ReglasCuenta | null,
  producto: ProductoParaPrecio
): ResultadoPrecio {
  const { descuento_pct, descuento_origen } = aplicarReglas(reglas, producto);
  const precio_final = Math.round(precio_base * (1 - descuento_pct / 100) * 100) / 100;
  return { precio_final, descuento_pct, descuento_origen };
}
