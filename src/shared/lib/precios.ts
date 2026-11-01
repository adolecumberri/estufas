import { cacheBorrar, cacheEdad, cacheEscribir, cacheLeer } from '@/shared/lib/cache';
import { supabase } from '@/shared/lib/supabase';
import type { Combustible, DescuentosCuenta, OrigenDescuento } from '@/shared/lib/types';

// ============================================================================
// Reglas de precios del cliente (réplica local del servidor, fn_calcular_precio
// de supabase/migrations/0025_descuentos_precedencia.sql).
//
// Precedencia del servidor (0025, por PRECISIÓN; el % no decide el nivel):
//   producto > categoría (del proveedor del producto, mejor % si hay varias)
//   > proveedor > general (>0) > promo (la promo solo gana si es MAYOR; no se
//   acumulan; 0% específico sustituye). El nivel "combustible" (0006) queda
//   FUERA de la cadena.
// ============================================================================

export interface ReglasCuenta {
  /** Descuento general del cliente (usuarios.descuento_porcentaje). */
  general_pct: number | null;
  /** Descuento específico por producto (producto_id → pct). */
  productos: Map<string, number>;
  /** Descuentos por categoría (0025): clave `proveedor_id:categoria_id` → pct. */
  categorias: Map<string, number>;
  /** Descuentos por proveedor (0025): proveedor_id → pct. */
  proveedores: Map<string, number>;
  /** Descuento por combustible (0006): conservado por compatibilidad del DTO;
      YA NO se consulta en la precedencia (0025 lo retira de la cadena). */
  combustibles: Map<string, number>;
  /** Promoción de tienda vigente (la mejor, ya agregada por el servidor). */
  promo_pct: number | null;
  /** Proveedores habilitados para el comercial efectivo de esta cuenta. */
  proveedores_habilitados: string[];
}

// Mínimo del producto que necesita la regla de precios. `proveedor_id` y
// `categorias` (IDs) son opcionales por compatibilidad: sin ellos solo se
// aplican los niveles producto/general/promo.
export interface ProductoParaPrecio {
  producto_id: string;
  combustibles: Combustible[];
  /** Proveedor del producto (0025: las reglas de categoría/proveedor se acotan a él). */
  proveedor_id?: string | null;
  /** IDs de las categorías del producto (0025: reglas de categoría). */
  categorias?: string[];
}

export interface ResultadoPrecio {
  precio_final: number;
  descuento_pct: number;
  descuento_origen: OrigenDescuento;
}

// Orígenes añadidos en 0025. ORIGENES_DESCUENTO de constantes aún no los
// declara: se tipan aquí y se ajustan al tipo público al salir (un único
// cast documentado), para no romper a los consumidores mientras tanto.
type OrigenEfectivo = OrigenDescuento | 'cliente_categoria' | 'cliente_proveedor';

// DTO del RPC fn_descuentos_cuenta con las claves nuevas de 0025 ('categorias'
// y 'proveedores'). El tipo DescuentosCuenta de types.ts aún no las incluye:
// aquí se amplían localmente y se leen con fallback (los DTOs cacheados de la
// versión anterior no las traen).
interface DescuentosCuentaDTO extends DescuentosCuenta {
  categorias?: { proveedor_id: string; categoria_id: string; pct: number }[];
  proveedores?: { proveedor_id: string; pct: number }[];
}

const CLAVE_REGLAS = 'estufas.cache.reglas.v1';
const TTL_REGLAS_MS = 5 * 60 * 1000; // 5 minutos por cuenta (offline friendly)
// Vida máxima de una autorización cacheada cuando NO se puede contactar con el
// servidor: pasada esa edad no se sirve la caché (evita seguir autorizando
// lecturas con una concesión de proveedores antigua; p. ej. tras reasignar
// clientes o revocar proveedores).
const EDAD_MAX_REGLAS_OFFLINE_MS = 24 * 60 * 60 * 1000;

const claveReglas = (uid: string | null, clienteId: string | null | undefined) =>
  `${CLAVE_REGLAS}:${uid ?? 'anon'}:${clienteId ?? 'propia'}`;

// El RPC lanza 'Sin permiso para consultar las condiciones de ese cliente'
// cuando la cuenta no puede pedir esas condiciones: es una DENEGACIÓN (no una
// caída de red) y no debe reutilizar la caché.
const esDenegacionPermisos = (mensaje: string | undefined): boolean =>
  Boolean(mensaje && /sin permiso/i.test(mensaje));

// Convierte el resultado del RPC fn_descuentos_cuenta en las reglas locales.
function aReglas(datos: DescuentosCuentaDTO | null | undefined): ReglasCuenta | null {
  if (!datos) return null;
  return {
    general_pct: typeof datos.general_pct === 'number' ? datos.general_pct : null,
    productos: new Map((datos.productos ?? []).map((d) => [d.producto_id, d.pct])),
    categorias: new Map(
      (datos.categorias ?? []).map((d) => [`${d.proveedor_id}:${d.categoria_id}`, d.pct])
    ),
    proveedores: new Map((datos.proveedores ?? []).map((d) => [d.proveedor_id, d.pct])),
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
  const enCache = await cacheLeer<DescuentosCuentaDTO>(clave);
  const edad = await cacheEdad(clave);
  const vigente = enCache && edad !== null && edad <= TTL_REGLAS_MS;
  if (vigente && enCache) return aReglas(enCache);

  try {
    const { data, error } = await supabase.rpc('fn_descuentos_cuenta', {
      p_cliente: clienteId ?? null,
    });
    if (error) {
      // Denegación explícita de permisos: se invalida la caché y no se sirve
      // (una autorización revocada no debe sobrevivir en local).
      if (esDenegacionPermisos(error.message)) {
        void cacheBorrar(clave);
        return null;
      }
      // Error transitorio (red/servidor): se sirve la caché solo dentro de la
      // ventana offline acotada.
      if (enCache && edad !== null && edad <= EDAD_MAX_REGLAS_OFFLINE_MS) {
        return aReglas(enCache);
      }
      return null;
    }
    if (!data) {
      if (enCache && edad !== null && edad <= EDAD_MAX_REGLAS_OFFLINE_MS) {
        return aReglas(enCache);
      }
      return null;
    }
    const dto = data as DescuentosCuentaDTO;
    void cacheEscribir(clave, dto);
    return aReglas(dto);
  } catch {
    // Excepción de red: misma ventana offline acotada.
    if (enCache && edad !== null && edad <= EDAD_MAX_REGLAS_OFFLINE_MS) {
      return aReglas(enCache);
    }
    return null;
  }
}

// Aplica las reglas de cuenta a un producto replicando fn_calcular_precio
// (0025) con la MISMA semántica que el servidor:
//   1. producto (0% incluido) gana por precisión;
//   2. si no, categoría: mejor % entre las reglas de categorías ACOTADAS al
//      proveedor del producto que coinciden con sus categorías;
//   3. si no, proveedor del producto (0% incluido);
//   4. si no, general solo si > 0;
//   5. por último, la promo de tienda gana SOLO si su % es mayor.
export function aplicarReglas(
  reglas: ReglasCuenta | null,
  producto: ProductoParaPrecio
): { descuento_pct: number; descuento_origen: OrigenDescuento } {
  if (!reglas) return { descuento_pct: 0, descuento_origen: 'ninguno' };

  let pct = 0;
  let origen: OrigenEfectivo = 'ninguno';

  const especifico = reglas.productos.get(producto.producto_id);
  if (especifico !== undefined) {
    // 1) Producto específico: gana aunque sea 0% (sustituye a todo lo demás).
    pct = especifico;
    origen = 'cliente_producto';
  } else if (producto.proveedor_id) {
    // 2) Categoría del proveedor del producto (varias → el mayor %).
    let mejorCategoria: number | null = null;
    for (const categoriaId of producto.categorias ?? []) {
      const d = reglas.categorias.get(`${producto.proveedor_id}:${categoriaId}`);
      if (d !== undefined && (mejorCategoria === null || d > mejorCategoria)) {
        mejorCategoria = d;
      }
    }
    if (mejorCategoria !== null) {
      pct = mejorCategoria;
      origen = 'cliente_categoria';
    } else {
      // 3) Proveedor del producto (0% incluido: sustituye al general).
      const dProveedor = reglas.proveedores.get(producto.proveedor_id);
      if (dProveedor !== undefined) {
        pct = dProveedor;
        origen = 'cliente_proveedor';
      } else if (reglas.general_pct !== null && reglas.general_pct > 0) {
        // 4) General: solo cuenta si es positivo (0 = ninguno).
        pct = reglas.general_pct;
        origen = 'cliente_general';
      }
    }
  } else if (reglas.general_pct !== null && reglas.general_pct > 0) {
    // Producto sin proveedor: las reglas de categoría/proveedor no aplican.
    pct = reglas.general_pct;
    origen = 'cliente_general';
  }

  // 5) Promo: último recurso; gana SOLO si supera el candidato (no se acumula).
  const promo = reglas.promo_pct ?? 0;
  if (promo > pct) {
    pct = promo;
    origen = 'promocion_tienda';
  }

  // El tipo público OrigenDescuento aún no declara los orígenes de 0025.
  return { descuento_pct: pct, descuento_origen: origen as OrigenDescuento };
}

// Precio final replicando round(precio_base * (1 - pct/100), 2) del servidor.
// El cálculo se hace en enteros (céntimos y puntos básicos) para evitar
// desviaciones de 1 céntimo del redondeo en coma flotante frente al tipo
// numeric de Postgres.
export function calcularPrecioFinal(
  precio_base: number,
  reglas: ReglasCuenta | null,
  producto: ProductoParaPrecio
): ResultadoPrecio {
  const { descuento_pct, descuento_origen } = aplicarReglas(reglas, producto);
  const centimos = Math.round(precio_base * 100);
  const puntosBase = Math.round(descuento_pct * 100);
  const precio_final = Math.round((centimos * (10000 - puntosBase)) / 10000) / 100;
  return { precio_final, descuento_pct, descuento_origen };
}
