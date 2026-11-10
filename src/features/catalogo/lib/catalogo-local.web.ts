import type { ReglasCuenta } from '@/shared/lib/precios';
import type {
  Categoria,
  Combustible,
  Marca,
  ProductoCatalogo,
  ProductoDetalle,
  SnapshotCatalogo,
} from '@/shared/lib/types';

// ============================================================================
// Variante WEB de catalogo-local (Metro resuelve esta en web en lugar de
// catalogo-local.ts): expo-sqlite no resuelve en web (no existe SQLiteModule),
// así que este módulo NO importa expo-sqlite y TODAS las operaciones lanzan un
// error controlado.
//
// El camino de red es el soportado en web:
//   - use-catalogo/use-producto capturan el error de inicializarBd() y caen a
//     fn_catalogo_usuario_v2/fn_producto_detalle + caché AsyncStorage;
//   - los llamadores directos (obtenerProducto en pedidos/[id]) ya capturan el
//     error y usan su fallback.
// ============================================================================

export const SQLITE_NO_DISPONIBLE = 'El catálogo local (SQLite) no está disponible en web.';

function sinSqlite(): never {
  throw new Error(SQLITE_NO_DISPONIBLE);
}

// Mismas interfaces públicas que la variante nativa (solo tipos).
export interface FilaProductoLocal {
  producto_id: string;
  referencia: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  tipo: string | null;
  marca_id: string | null;
  marca_nombre: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  destacado: number;
  etiqueta_energetica: string | null;
  imagen_url: string | null;
  plano_url: string | null;
  precio_base: number;
  precios_transporte: string | null;
  combustibles: string;
  categorias: string;
  categorias_nombres: string;
  datos: string;
  galeria: string;
  activo: number;
}

export interface OpcionesConsulta {
  busqueda: string;
  combustible: Combustible | null;
  categoria: string | null;
  marca: string | null;
  pagina: number;
  limite: number;
  proveedoresVisibles: string[] | null;
  proveedorId?: string | null;
}

export function inicializarBd(): void {
  sinSqlite();
}

export async function obtenerVersionLocal(): Promise<number | null> {
  sinSqlite();
}

export function reemplazarSnapshot(_snapshot: SnapshotCatalogo): void {
  sinSqlite();
}

export async function sincronizarCatalogo(): Promise<{ version: number; desdeRed: boolean }> {
  sinSqlite();
}

export function consultarCatalogo(_opciones: OpcionesConsulta): {
  filas: FilaProductoLocal[];
  hayMas: boolean;
} {
  sinSqlite();
}

export function consultarCatalogoCompleto(_opciones: {
  busqueda: string;
  combustible: Combustible | null;
  categoria: string | null;
  marca: string | null;
  proveedoresVisibles: string[] | null;
  proveedorId?: string | null;
}): FilaProductoLocal[] {
  sinSqlite();
}

export function obtenerProducto(_id: string): FilaProductoLocal | null {
  sinSqlite();
}

export function obtenerCategorias(): Categoria[] {
  sinSqlite();
}

export function obtenerMarcas(): Marca[] {
  sinSqlite();
}

export function obtenerFiltrosProveedor(_proveedorId: string | null): {
  combustibles: Combustible[];
  categorias: Categoria[];
} {
  sinSqlite();
}

export function filaAProductoCatalogo(
  _fila: FilaProductoLocal,
  _reglas: ReglasCuenta | null
): ProductoCatalogo {
  sinSqlite();
}

export function filaAProductoDetalle(
  _fila: FilaProductoLocal,
  _reglas: ReglasCuenta | null
): ProductoDetalle {
  sinSqlite();
}
