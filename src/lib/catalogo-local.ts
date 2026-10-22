import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { MONEDA } from '@/constants';
import { calcularPrecioFinal, type ReglasCuenta } from '@/lib/precios';
import { supabase } from '@/lib/supabase';
import type {
  Categoria,
  Combustible,
  GrupoDatos,
  Marca,
  ProductoCatalogo,
  ProductoDetalle,
  SnapshotCatalogo,
  ValorCaracteristica,
} from '@/lib/types';

// ============================================================================
// Catálogo local (SQLite): el catálogo y las fichas se sirven desde una BD
// local tras descargar UNA vez el snapshot del servidor (RPC
// fn_catalogo_snapshot). Si la versión cambia (fn_catalogo_version) se vuelve
// a descargar. En plataformas sin SQLite (web sin wasm) obtenerBd() lanza un
// error claro y el hook cae al camino de red anterior.
// ============================================================================

const NOMBRE_BD = 'catalogo-local.db';

const SQL_ESQUEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categorias (
  id TEXT PRIMARY KEY NOT NULL,
  nombre TEXT NOT NULL,
  clave TEXT NOT NULL,
  grupo TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  combustible TEXT
);
CREATE TABLE IF NOT EXISTS marcas (
  id TEXT PRIMARY KEY NOT NULL,
  nombre TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS proveedores (
  id TEXT PRIMARY KEY NOT NULL,
  nombre TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS productos (
  producto_id TEXT PRIMARY KEY NOT NULL,
  referencia TEXT NOT NULL,
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT,
  marca_id TEXT,
  marca_nombre TEXT,
  proveedor_id TEXT,
  proveedor_nombre TEXT,
  destacado INTEGER NOT NULL DEFAULT 0,
  etiqueta_energetica TEXT,
  imagen_url TEXT,
  plano_url TEXT,
  precio_base REAL NOT NULL,
  precios_transporte TEXT,
  combustibles TEXT NOT NULL DEFAULT '[]',
  combustibles_pipe TEXT NOT NULL DEFAULT '|',
  categorias TEXT NOT NULL DEFAULT '[]',
  categorias_pipe TEXT NOT NULL DEFAULT '|',
  categorias_nombres TEXT NOT NULL DEFAULT '[]',
  datos TEXT NOT NULL DEFAULT '[]',
  busqueda_normalizado TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_productos_orden ON productos (destacado, nombre);
`;

let bd: SQLiteDatabase | null = null;

// Abre (una sola vez) la BD y crea el esquema. Si la plataforma no soporta
// SQLite lanza un error claro que los hooks capturan para hacer fallback a red.
export function inicializarBd(): void {
  if (bd) return;
  try {
    bd = openDatabaseSync(NOMBRE_BD);
    bd.execSync('PRAGMA journal_mode = WAL;');
    bd.execSync(SQL_ESQUEMA);
  } catch (error) {
    bd = null;
    throw new Error(
      'El catálogo local (SQLite) no está disponible en esta plataforma: ' +
        (error instanceof Error ? error.message : String(error))
    );
  }
}

function obtenerBd(): SQLiteDatabase {
  inicializarBd();
  return bd as SQLiteDatabase;
}

// Normaliza texto para la búsqueda local: minúsculas y sin tildes (aproxima
// el ILIKE del servidor; la comparación se hace contra el texto ya
// normalizado de la columna busqueda_normalizado).
function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Serializa una lista como '|a|b|' (o '|' si está vacía) para poder filtrar
// pertenencia con LIKE '%|valor|%' sin SQL dinámico.
function aPipe(valores: (string | null | undefined)[]): string {
  const presentes = valores.filter((v): v is string => Boolean(v));
  return presentes.length === 0 ? '|' : `|${presentes.join('|')}|`;
}

function parseJson<T>(texto: string | null): T | null {
  if (!texto) return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}

export async function obtenerVersionLocal(): Promise<number | null> {
  const db = obtenerBd();
  const fila = db.getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', ['version']);
  const numero = fila ? Number(fila.value) : NaN;
  return Number.isFinite(numero) ? numero : null;
}

// Sustituye TODO el contenido local por el snapshot del servidor (transacción).
// Las marcas y categorías se desnormalizan por nombre en cada fila de producto
// para poder devolver el ProductoCatalogo sin JOINs posteriores.
export function reemplazarSnapshot(snapshot: SnapshotCatalogo): void {
  const db = obtenerBd();
  const nombreMarca = new Map(snapshot.marcas.map((m) => [m.id, m.nombre]));
  const nombreCategoria = new Map(snapshot.categorias.map((c) => [c.id, c.nombre]));

  db.withTransactionSync(() => {
    db.execSync('DELETE FROM productos; DELETE FROM categorias; DELETE FROM marcas; DELETE FROM proveedores;');

    for (const c of snapshot.categorias) {
      db.runSync(
        'INSERT INTO categorias (id, nombre, clave, grupo, orden, combustible) VALUES (?, ?, ?, ?, ?, ?)',
        [c.id, c.nombre, c.clave, c.grupo, c.orden, c.combustible]
      );
    }
    for (const m of snapshot.marcas) {
      db.runSync('INSERT INTO marcas (id, nombre) VALUES (?, ?)', [m.id, m.nombre]);
    }
    for (const p of snapshot.proveedores) {
      db.runSync('INSERT INTO proveedores (id, nombre) VALUES (?, ?)', [p.id, p.nombre]);
    }

    const SQL_PRODUCTO = `INSERT INTO productos (
      producto_id, referencia, nombre, slug, descripcion, tipo, marca_id,
      marca_nombre, proveedor_id, proveedor_nombre, destacado,
      etiqueta_energetica, imagen_url, plano_url, precio_base,
      precios_transporte, combustibles, combustibles_pipe, categorias,
      categorias_pipe, categorias_nombres, datos, busqueda_normalizado, activo
    ) VALUES (${Array.from({ length: 24 }, () => '?').join(', ')})`;

    for (const pr of snapshot.productos) {
      const nombresCategorias = pr.categorias
        .map((id) => nombreCategoria.get(id))
        .filter((n): n is string => Boolean(n));
      db.runSync(SQL_PRODUCTO, [
        pr.producto_id,
        pr.referencia,
        pr.nombre,
        pr.slug,
        pr.descripcion,
        pr.tipo,
        pr.marca_id,
        pr.marca_id ? (nombreMarca.get(pr.marca_id) ?? null) : null,
        pr.proveedor_id,
        pr.proveedor_nombre,
        pr.destacado ? 1 : 0,
        pr.etiqueta_energetica,
        pr.imagen_url,
        pr.plano_url,
        pr.precio_base,
        JSON.stringify(pr.precios_transporte ?? {}),
        JSON.stringify(pr.combustibles ?? []),
        aPipe(pr.combustibles ?? []),
        JSON.stringify(pr.categorias ?? []),
        aPipe(pr.categorias ?? []),
        JSON.stringify(nombresCategorias),
        JSON.stringify(pr.datos ?? []),
        normalizarTexto(`${pr.nombre} ${pr.referencia}`),
        pr.activo ? 1 : 0,
      ]);
    }

    db.runSync(
      "INSERT INTO meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [String(snapshot.version)]
    );
  });
}

// Comprueba la versión del servidor y descarga el snapshot solo si no hay
// copia local o la versión cambió (una sola llamada grande). Si la red falla
// y existe snapshot local se sigue sirviendo el local (modo offline).
export async function sincronizarCatalogo(): Promise<{ version: number; desdeRed: boolean }> {
  const local = await obtenerVersionLocal();
  const { data, error } = await supabase.rpc('fn_catalogo_version');
  if (error) {
    if (local !== null) return { version: local, desdeRed: false };
    throw new Error('No hay catálogo local y no se pudo contactar con el servidor.');
  }
  const version = typeof data === 'number' ? data : Number(data);
  if (local === null || version !== local) {
    const { data: datos, error: errorSnapshot } = await supabase.rpc('fn_catalogo_snapshot');
    if (errorSnapshot || !datos) {
      if (local !== null) return { version: local, desdeRed: false };
      throw new Error('No se pudo descargar el catálogo.');
    }
    const snapshot = datos as unknown as SnapshotCatalogo;
    reemplazarSnapshot(snapshot);
    return { version: snapshot.version, desdeRed: true };
  }
  return { version: local, desdeRed: false };
}

// Fila tal cual se guarda en SQLite (JSON en columnas TEXT).
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
  activo: number;
}

export interface OpcionesConsulta {
  busqueda: string;
  combustible: Combustible | null;
  categoria: string | null;
  marca: string | null;
  pagina: number;
  limite: number;
  // null → sin filtro de proveedor (anónimo / admin sin cliente objetivo ven
  // todo); lista → productos sin proveedor + los proveedores habilitados.
  proveedoresVisibles: string[] | null;
}

// Consulta local con los mismos criterios que fn_catalogo_usuario_v2:
// búsqueda sobre nombre/referencia, combustible (producto con ESE combustible
// O agnóstico), categoría por pertenencia, marca exacta, orden
// destacado DESC + nombre ASC y paginación con +1 para saber si hay más.
// Solo se usan parámetros (nada de interpolación de texto de usuario en SQL).
export function consultarCatalogo(opciones: OpcionesConsulta): {
  filas: FilaProductoLocal[];
  hayMas: boolean;
} {
  const db = obtenerBd();
  const condiciones: string[] = ['activo = 1'];
  const parametros: (string | number | null)[] = [];

  const busquedaLimpia = opciones.busqueda.trim();
  if (busquedaLimpia) {
    condiciones.push('busqueda_normalizado LIKE ?');
    parametros.push(`%${normalizarTexto(busquedaLimpia)}%`);
  }
  // La búsqueda cruza combustibles (igual que el servidor).
  if (opciones.combustible && !busquedaLimpia) {
    condiciones.push("(combustibles_pipe LIKE ? OR combustibles_pipe = '|')");
    parametros.push(`%|${opciones.combustible}|%`);
  }
  if (opciones.categoria) {
    condiciones.push('categorias_pipe LIKE ?');
    parametros.push(`%|${opciones.categoria}|%`);
  }
  if (opciones.marca) {
    condiciones.push('marca_id = ?');
    parametros.push(opciones.marca);
  }
  if (opciones.proveedoresVisibles !== null) {
    const habilitados = opciones.proveedoresVisibles;
    if (habilitados.length === 0) {
      condiciones.push('proveedor_id IS NULL');
    } else {
      const huecos = habilitados.map(() => '?').join(', ');
      condiciones.push(`(proveedor_id IS NULL OR proveedor_id IN (${huecos}))`);
      parametros.push(...habilitados);
    }
  }

  const limite = Math.max(1, opciones.limite + 1); // +1 para saber si hay más
  const offset = Math.max(0, opciones.pagina) * opciones.limite;
  const filas = db.getAllSync<FilaProductoLocal>(
    `SELECT * FROM productos WHERE ${condiciones.join(' AND ')}
     ORDER BY destacado DESC, nombre ASC LIMIT ? OFFSET ?`,
    [...parametros, limite, offset]
  );
  return { filas: filas.slice(0, opciones.limite), hayMas: filas.length > opciones.limite };
}

export function obtenerProducto(id: string): FilaProductoLocal | null {
  const db = obtenerBd();
  return db.getFirstSync<FilaProductoLocal>('SELECT * FROM productos WHERE producto_id = ?', [id]);
}

// Filtros disponibles (catálogo local). Extensiones de la capa: el snapshot
// trae categorías y marcas y los hooks las sirven desde aquí.
export function obtenerCategorias(): Categoria[] {
  const db = obtenerBd();
  const filas = db.getAllSync<{ id: string; nombre: string; clave: string; grupo: string; orden: number; combustible: string | null }>(
    'SELECT id, nombre, clave, grupo, orden, combustible FROM categorias ORDER BY orden, nombre'
  );
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    clave: f.clave,
    grupo: f.grupo,
    orden: f.orden,
    combustible: (f.combustible as Combustible | null) ?? null,
  }));
}

export function obtenerMarcas(): Marca[] {
  const db = obtenerBd();
  return db.getAllSync<Marca>('SELECT id, nombre FROM marcas ORDER BY nombre');
}

const preciosTransporte = (fila: FilaProductoLocal) =>
  parseJson<{ camion: number | null; palet: number | null; franquicia: number | null }>(
    fila.precios_transporte
  );

// Fila local → ProductoCatalogo con el precio calculado por las reglas de la
// cuenta (calcularPrecioFinal replica fn_calcular_precio).
export function filaAProductoCatalogo(fila: FilaProductoLocal, reglas: ReglasCuenta | null): ProductoCatalogo {
  const combustibles = parseJson<Combustible[]>(fila.combustibles) ?? [];
  const { precio_final, descuento_pct, descuento_origen } = calcularPrecioFinal(fila.precio_base, reglas, {
    producto_id: fila.producto_id,
    combustibles,
  });
  return {
    producto_id: fila.producto_id,
    referencia: fila.referencia,
    nombre: fila.nombre,
    slug: fila.slug,
    descripcion: fila.descripcion,
    marca: fila.marca_nombre,
    tipo: fila.tipo,
    categorias: parseJson<string[]>(fila.categorias_nombres) ?? [],
    etiqueta_energetica: fila.etiqueta_energetica,
    destacado: Boolean(fila.destacado),
    precio_base: fila.precio_base,
    precio_final,
    descuento_pct,
    descuento_origen,
    moneda: MONEDA.codigo, // el snapshot no trae moneda: se asume la de la app
    imagen_url: fila.imagen_url,
    proveedor_id: fila.proveedor_id,
    proveedor_nombre: fila.proveedor_nombre,
    precios_transporte: preciosTransporte(fila) ?? null,
  };
}

// Fila local → ProductoDetalle. El snapshot no trae galería ni características
// (vienen vacías); las características se reconstruyen desde `datos` para que
// la ficha siga mostrando los datos técnicos con el render actual.
export function filaAProductoDetalle(fila: FilaProductoLocal, reglas: ReglasCuenta | null): ProductoDetalle {
  const base = filaAProductoCatalogo(fila, reglas);
  const datos = parseJson<GrupoDatos[]>(fila.datos) ?? [];
  const caracteristicas: ValorCaracteristica[] = datos.flatMap((g) =>
    g.filas.map((f, orden) => ({
      clave: f.clave,
      nombre: f.nombre,
      unidad: f.unidad,
      grupo: g.grupo,
      orden,
      valor: f.valor ?? '',
    }))
  );
  return { ...base, plano_url: fila.plano_url, caracteristicas, galeria: [], datos };
}
