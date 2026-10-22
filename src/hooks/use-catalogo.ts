import * as React from 'react';

import { PAGINACION } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import { cacheEscribir, cacheLeer } from '@/lib/cache';
import {
  consultarCatalogo,
  filaAProductoCatalogo,
  inicializarBd,
  obtenerCategorias,
  obtenerMarcas,
  sincronizarCatalogo,
} from '@/lib/catalogo-local';
import { obtenerReglasCuenta, type ReglasCuenta } from '@/lib/precios';
import { supabase } from '@/lib/supabase';
import type { Categoria, Combustible, Marca, ProductoCatalogo } from '@/lib/types';

const DEBOUNCE_MS = 300;

// Caché AsyncStorage (solo para el camino de red, cuando SQLite no está
// disponible): filtros 24 h y páginas stale-while-revalidate, como antes.
const CLAVE_CATEGORIAS = 'estufas.cache.categorias.v1';
const CLAVE_MARCAS = 'estufas.cache.marcas.v1';
const TTL_FILTROS_MS = 24 * 60 * 60 * 1000;

// La clave de productos incluye la CUENTA autenticada: los precios se
// personalizan por usuario, y sin esto un visitante anónimo u otro cliente
// podría ver precios de una cuenta previa desde la caché.
const claveProductos = (
  uid: string | null,
  clienteId: string | null | undefined,
  busqueda: string,
  combustible: Combustible,
  categoria: string | null,
  marca: string | null,
  pagina: number,
  proveedorId: string | null | undefined
) =>
  `estufas.cache.productos.v1:${uid ?? 'anon'}:${clienteId ?? 'anon'}:${busqueda}|${combustible}|${categoria ?? ''}|${marca ?? ''}|${pagina}|${proveedorId ?? ''}`;

// Visibilidad por proveedor replicando fn_catalogo_usuario_v2 (0007/0009):
// anónimo y admin sin cliente objetivo ven todo (null); el resto ve los
// productos sin proveedor más los proveedores habilitados en sus reglas.
function proveedoresVisibles(
  uid: string | null,
  esAdmin: boolean,
  clienteId: string | null | undefined,
  reglas: ReglasCuenta | null
): string[] | null {
  if (!uid) return null;
  if (esAdmin && !clienteId) return null;
  if (!reglas) return []; // sin reglas (error de red): solo productos sin proveedor
  return reglas.proveedores_habilitados;
}

// Catálogo con búsqueda y filtros servido desde SQLite local (snapshot
// descargado una vez por versión) con fallback a la red anterior si la
// plataforma no soporta SQLite. La API pública no cambia.
// `clienteId`: cuando un comercial crea un pedido para un cliente asignado,
// el catálogo muestra las condiciones de ESE cliente.
// `proveedorId`: restringe el catálogo a un proveedor (vista de admin).
export function useCatalogo(clienteId?: string | null, proveedorId?: string | null) {
  const { session, perfil } = useAuth();
  const uid = session?.user?.id ?? null;

  const [busqueda, setBusqueda] = React.useState('');
  const [combustible, setCombustibleState] = React.useState<Combustible>('pellets');
  const [categoria, setCategoria] = React.useState<string | null>(null);
  const [marca, setMarca] = React.useState<string | null>(null);
  const [pagina, setPagina] = React.useState(0);

  // Cambiar de combustible invalida la categoría (puede no existir en el otro).
  const setCombustible = (c: Combustible) => {
    setCombustibleState(c);
    setCategoria(null);
    setPagina(0);
  };

  const [productosBruto, setProductos] = React.useState<ProductoCatalogo[]>([]);
  // Clave (cuenta/cliente/filtros/página) a la que pertenece el resultado
  // mostrado. Mientras no coincida con la petición actual no se muestra nada:
  // evita pintar precios de la identidad anterior durante una transición.
  const [claveMostrada, setClaveMostrada] = React.useState<string | null>(null);
  const [categorias, setCategorias] = React.useState<Categoria[]>([]);
  const [marcas, setMarcas] = React.useState<Marca[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [hayMas, setHayMas] = React.useState(false);

  // Datos base de la cuenta actual: si el catálogo local está disponible y
  // las reglas de precio ya cargadas. null = sincronizando (no se pinta nada).
  const [datosBase, setDatosBase] = React.useState<{ modoLocal: boolean; reglas: ReglasCuenta | null } | null>(null);

  const claveProductosActual = claveProductos(
    uid,
    clienteId,
    busqueda,
    combustible,
    categoria,
    marca,
    pagina,
    proveedorId
  );
  const productos = claveMostrada === claveProductosActual ? productosBruto : [];
  const mostrandoCarga = cargando || claveMostrada !== claveProductosActual;

  // Sincronización por cuenta/cliente: reglas de cuenta (caché 5 min) + versión
  // del snapshot (descarga completa solo si cambió). Si SQLite no está
  // disponible se cae al camino de red con el comportamiento anterior.
  React.useEffect(() => {
    let cancelado = false;
    setError(null);
    setCargando(true);
    setDatosBase(null);
    setProductos([]);
    setClaveMostrada(null);

    void (async () => {
      let modoLocal = true;
      try {
        inicializarBd();
      } catch {
        modoLocal = false;
      }
      const reglas = await obtenerReglasCuenta(uid, clienteId);
      if (cancelado) return;

      if (modoLocal) {
        try {
          await sincronizarCatalogo();
        } catch (e) {
          if (cancelado) return;
          // Sin snapshot local y sin red: error claro (si existía snapshot
          // local, sincronizarCatalogo no lanza y se sirve el viejo).
          setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.');
          setCargando(false);
          return;
        }
        if (cancelado) return;
        try {
          setCategorias(obtenerCategorias());
          setMarcas(obtenerMarcas());
        } catch (e) {
          if (cancelado) return;
          setError(e instanceof Error ? e.message : 'No se pudo leer el catálogo local.');
          setCargando(false);
          return;
        }
        setDatosBase({ modoLocal: true, reglas });
        return;
      }

      // Camino de red (sin SQLite): filtros desde caché/red como antes.
      const [cCat, cMar] = await Promise.all([
        cacheLeer<Categoria[]>(CLAVE_CATEGORIAS),
        cacheLeer<Marca[]>(CLAVE_MARCAS),
      ]);
      if (cancelado) return;
      if (cCat) setCategorias(cCat);
      if (cMar) setMarcas(cMar);

      const [resCat, resMar] = await Promise.all([
        supabase
          .from('categorias')
          .select('id,nombre,clave,grupo,orden,combustible')
          .eq('activo', true)
          .eq('borrado', false)
          .order('orden'),
        supabase
          .from('marcas')
          .select('id,nombre')
          .eq('activo', true)
          .eq('borrado', false)
          .order('nombre'),
      ]);
      if (cancelado) return;
      if (resCat && !resCat.error) {
        const filas = (resCat.data as Categoria[]) ?? [];
        setCategorias(filas);
        void cacheEscribir(CLAVE_CATEGORIAS, filas);
      }
      if (resMar && !resMar.error) {
        const filas = (resMar.data as Marca[]) ?? [];
        setMarcas(filas);
        void cacheEscribir(CLAVE_MARCAS, filas);
      }
      setDatosBase({ modoLocal: false, reglas });
    })();

    return () => {
      cancelado = true;
    };
  }, [uid, clienteId, perfil?.rol]);

  // Consulta (debounce): catálogo local con precios calculados por las reglas
  // de la cuenta, o el RPC anterior cuando no hay SQLite.
  React.useEffect(() => {
    if (!datosBase) return;
    let cancelado = false;
    // Si la red responde antes que la caché, la caché NO debe pisar los
    // datos frescos (carrera caché-vs-red, camino de red).
    let aplicadoRed = false;
    setError(null);
    setCargando(true);

    const clave = claveProductosActual;

    if (datosBase.modoLocal) {
      const t = setTimeout(() => {
        if (cancelado) return;
        try {
          const visibles = proveedoresVisibles(uid, perfil?.rol === 'admin', clienteId, datosBase.reglas);
          const { filas, hayMas: mas } = consultarCatalogo({
            busqueda,
            combustible: busqueda.trim() ? null : combustible,
            categoria,
            marca,
            pagina,
            limite: PAGINACION.catalogo,
            proveedoresVisibles: visibles,
          });
          if (cancelado) return;
          // El snapshot ya trae proveedor_id: el filtro por proveedor se
          // aplica AQUÍ (catalogo-local.ts no admite proveedor). En la vista
          // de admin es aceptable que la página quede corta cuando el
          // proveedor no llena la página completa.
          let filasMapeadas = filas.map((f) => filaAProductoCatalogo(f, datosBase.reglas));
          if (proveedorId) {
            filasMapeadas = filasMapeadas.filter((p) => p.proveedor_id === proveedorId);
          }
          setProductos(filasMapeadas);
          setHayMas(mas);
        } catch (e) {
          if (cancelado) return;
          setError(e instanceof Error ? e.message : 'No se pudo consultar el catálogo local.');
          setProductos([]);
        } finally {
          if (!cancelado) {
            setClaveMostrada(clave);
            setCargando(false);
          }
        }
      }, DEBOUNCE_MS);

      return () => {
        cancelado = true;
        clearTimeout(t);
      };
    }

    // Camino de red (sin SQLite): stale-while-revalidate como antes.
    void (async () => {
      const enCache = await cacheLeer<ProductoCatalogo[]>(clave);
      if (cancelado || aplicadoRed) return;
      if (enCache) {
        setProductos(enCache);
        setClaveMostrada(clave);
        setCargando(false);
      }
    })();

    const t = setTimeout(() => {
      void (async () => {
        const limite = PAGINACION.catalogo + 1; // +1 para saber si hay más páginas
        const { data, error } = await supabase.rpc('fn_catalogo_usuario_v2', {
          p_busqueda: busqueda.trim() || null,
          p_combustible: busqueda.trim() ? null : combustible,
          p_categoria: categoria,
          p_marca: marca,
          p_limite: limite,
          p_offset: pagina * PAGINACION.catalogo,
          p_cliente: clienteId ?? null,
          p_proveedor: proveedorId ?? null,
        });
        if (cancelado) return;
        if (error) {
          setError(error.message);
          setProductos([]);
          setClaveMostrada(clave);
          setCargando(false);
          return;
        }
        const filas = (data ?? []) as ProductoCatalogo[];
        setHayMas(filas.length > PAGINACION.catalogo);
        const paginaFilas = filas.slice(0, PAGINACION.catalogo);
        aplicadoRed = true;
        setProductos(paginaFilas);
        setClaveMostrada(clave);
        setCargando(false);
        void cacheEscribir(clave, paginaFilas);
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [datosBase, busqueda, categoria, marca, pagina, clienteId, combustible, uid, perfil?.rol, proveedorId]);

  const limpiarFiltros = () => {
    setBusqueda('');
    setCategoria(null);
    setMarca(null);
    setPagina(0);
  };

  return {
    productos,
    categorias,
    marcas,
    busqueda,
    setBusqueda,
    combustible,
    setCombustible,
    categoria,
    setCategoria,
    marca,
    setMarca,
    pagina,
    setPagina,
    hayMas,
    cargando: mostrandoCarga,
    error,
    limpiarFiltros,
    proveedor: proveedorId ?? null,
  };
}
