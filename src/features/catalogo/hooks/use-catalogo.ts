import * as React from 'react';

import { useAuth } from '@/features/auth/use-auth';
import { cacheEscribir, cacheLeer } from '@/shared/lib/cache';
import {
  consultarCatalogoCompleto,
  filaAProductoCatalogo,
  inicializarBd,
  obtenerCategorias,
  obtenerMarcas,
  sincronizarCatalogo,
} from '@/features/catalogo/lib/catalogo-local';
import {
  obtenerFiltrosProveedorCacheados,
  type FiltrosProveedor,
} from '@/features/catalogo/lib/filtros-proveedor';
import { obtenerReglasCuenta, type ReglasCuenta } from '@/shared/lib/precios';
import { supabase } from '@/shared/lib/supabase';
import type { Categoria, Combustible, Marca, ProductoCatalogo } from '@/shared/lib/types';

const DEBOUNCE_MS = 300;
// Debounce del cálculo de filtros del menú lateral: más generoso que el de
// productos porque un swap de proveedores puede dispararlo varias veces.
const DEBOUNCE_FILTROS_MS = 400;

// Sin paginación (feedback 10/11/2026): el catálogo se sirve completo. La RPC
// fn_catalogo_usuario_v2 acepta hasta 2000 filas (0016), suficiente para el
// catálogo actual (Fansa: 1.364); SQLite lee el snapshot entero sin límite.
const LIMITE_TODO = 2000;

// Caché AsyncStorage (solo para el camino de red, cuando SQLite no está
// disponible): filtros 24 h y productos versionados por catalogo_version.
const CLAVE_CATEGORIAS = 'estufas.cache.categorias.v1';
const CLAVE_MARCAS = 'estufas.cache.marcas.v1';

// La clave de productos incluye la CUENTA autenticada (los precios se
// personalizan por usuario) y la VERSIÓN del catálogo: al cambiar la base de
// datos (catalogo_version) la caché se invalida sola; hasta entonces, se
// sirve sin volver a consultar.
const claveProductos = (
  uid: string | null,
  clienteId: string | null | undefined,
  busqueda: string,
  combustible: Combustible,
  categoria: string | null,
  marca: string | null,
  proveedorId: string | null | undefined,
  version: number
) =>
  `estufas.cache.productos.v2:${uid ?? 'anon'}:${clienteId ?? 'anon'}:${busqueda}|${combustible}|${categoria ?? ''}|${marca ?? ''}|${proveedorId ?? ''}|v${version}`;

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

  // Cambiar de combustible invalida la categoría (puede no existir en el otro).
  const setCombustible = (c: Combustible) => {
    setCombustibleState(c);
    setCategoria(null);
  };

  const [productosBruto, setProductos] = React.useState<ProductoCatalogo[]>([]);
  // Clave (cuenta/cliente/filtros/versión) a la que pertenece el resultado
  // mostrado. Mientras no coincida con la petición actual no se muestra nada:
  // evita pintar precios de la identidad anterior durante una transición.
  const [claveMostrada, setClaveMostrada] = React.useState<string | null>(null);
  const [categorias, setCategorias] = React.useState<Categoria[]>([]);
  const [marcas, setMarcas] = React.useState<Marca[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Datos base de la cuenta actual: si el catálogo local está disponible, las
  // reglas de precio ya cargadas y la versión del catálogo (para versionar la
  // caché del camino de red). null = sincronizando (no se pinta nada).
  const [datosBase, setDatosBase] = React.useState<{
    modoLocal: boolean;
    reglas: ReglasCuenta | null;
    version: number;
  } | null>(null);

  // Filtros del menú lateral: combustibles y categorías del proveedor activo,
  // SIEMPRE desde la BD (SQLite local o RPC fn_filtros_proveedor) con caché
  // por proveedor. NUNCA se cae a la lista global: mientras no hay datos se
  // mantienen las opciones del proveedor anterior (marcadas como cargando) o,
  // si es la primera carga, se muestran skeletons en el cajón.
  const [filtrosProveedor, setFiltrosProveedor] = React.useState<{
    listo: boolean;
    cargando: boolean;
    combustibles: Combustible[];
    categorias: Categoria[];
  }>({ listo: false, cargando: false, combustibles: [], categorias: [] });
  const filtrosPeticion = React.useRef(0);

  React.useEffect(() => {
    if (!datosBase) {
      setFiltrosProveedor((prev) => ({ ...prev, cargando: true }));
      return;
    }
    let cancelado = false;
    const peticionId = ++filtrosPeticion.current;
    const idProveedor = proveedorId ?? null;
    // Se mantienen las opciones previas mientras carga (el cajón las atenúa);
    // debounce + "última petición gana" aguantan el spam de cambios de
    // proveedor sin martillear la BD (la caché por proveedor lo remata).
    setFiltrosProveedor((prev) => ({ ...prev, cargando: true }));

    const t = setTimeout(() => {
      void (async () => {
        let resultado: FiltrosProveedor | null = null;
        try {
          resultado = await obtenerFiltrosProveedorCacheados(idProveedor, datosBase.modoLocal);
        } catch {
          resultado = null; // fallo: se mantienen las opciones previas
        }
        if (cancelado || peticionId !== filtrosPeticion.current) return;
        if (resultado) {
          setFiltrosProveedor({
            listo: true,
            cargando: false,
            combustibles: resultado.combustibles,
            categorias: resultado.categorias,
          });
        } else {
          setFiltrosProveedor((prev) => ({ ...prev, cargando: false }));
        }
      })();
    }, DEBOUNCE_FILTROS_MS);

    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [datosBase, proveedorId]);

  const claveProductosActual = claveProductos(
    uid,
    clienteId,
    busqueda,
    combustible,
    categoria,
    marca,
    proveedorId,
    datosBase?.version ?? 0
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
        // En SQLite la versión la gestiona el snapshot (descarga solo si
        // cambia); para la clave de caché de red basta con 0.
        setDatosBase({ modoLocal: true, reglas, version: 0 });
        return;
      }

      // Camino de red (sin SQLite): filtros desde caché/red como antes y
      // VERSIÓN del catálogo para invalidar la caché de productos cuando la
      // base de datos cambia (feedback 10/11/2026: carga única versionada).
      const [cCat, cMar, resVersion] = await Promise.all([
        cacheLeer<Categoria[]>(CLAVE_CATEGORIAS),
        cacheLeer<Marca[]>(CLAVE_MARCAS),
        supabase.rpc('fn_catalogo_version'),
      ]);
      if (cancelado) return;
      if (cCat) setCategorias(cCat);
      if (cMar) setMarcas(cMar);
      const version = typeof resVersion.data === 'number' ? resVersion.data : 0;

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
      setDatosBase({ modoLocal: false, reglas, version });
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
          const visibles = proveedoresVisibles(
            uid,
            perfil?.rol === 'admin',
            clienteId,
            datosBase.reglas
          );
          // Carga COMPLETA sin paginación (feedback 10/11/2026): una única
          // lectura síncrona del snapshot (Fansa: 1.364 filas) y precios
          // calculados en memoria con las reglas de la cuenta.
          const filas = consultarCatalogoCompleto({
            busqueda,
            combustible: busqueda.trim() ? null : combustible,
            categoria,
            marca,
            proveedoresVisibles: visibles,
            proveedorId,
          });
          if (cancelado) return;
          setProductos(filas.map((f) => filaAProductoCatalogo(f, datosBase.reglas)));
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

    // Camino de red (sin SQLite): stale-while-revalidate como antes. La clave
    // incluye catalogo_version: si la base de datos no cambió, la caché sirve
    // el catálogo completo sin volver a consultar.
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
        // Todo el catálogo del tirón: la RPC acepta hasta 2000 filas (0016).
        const { data, error } = await supabase.rpc('fn_catalogo_usuario_v2', {
          p_busqueda: busqueda.trim() || null,
          p_combustible: busqueda.trim() ? null : combustible,
          p_categoria: categoria,
          p_marca: marca,
          p_limite: LIMITE_TODO,
          p_offset: 0,
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
        aplicadoRed = true;
        setProductos(filas);
        setClaveMostrada(clave);
        setCargando(false);
        void cacheEscribir(clave, filas);
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [
    datosBase,
    busqueda,
    categoria,
    marca,
    clienteId,
    combustible,
    uid,
    perfil?.rol,
    proveedorId,
  ]);

  const limpiarFiltros = () => {
    setBusqueda('');
    setCategoria(null);
    setMarca(null);
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
    cargando: mostrandoCarga,
    error,
    limpiarFiltros,
    proveedor: proveedorId ?? null,
    filtrosProveedor,
  };
}
