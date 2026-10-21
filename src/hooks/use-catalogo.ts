import * as React from 'react';

import { PAGINACION } from '@/constants';
import { useAuth } from '@/hooks/use-auth';
import { cacheEdad, cacheEscribir, cacheLeer } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import type { Categoria, Combustible, Marca, ProductoCatalogo } from '@/lib/types';

const DEBOUNCE_MS = 300;

// Caché local (stale-while-revalidate): los filtros cambian poco (24 h) y las
// páginas del catálogo se pintan desde caché mientras la red revalida.
const CLAVE_CATEGORIAS = 'estufas.cache.categorias.v1';
const CLAVE_MARCAS = 'estufas.cache.marcas.v1';
const TTL_FILTROS_MS = 24 * 60 * 60 * 1000;

// La clave de productos incluye la CUENTA autenticada: los precios se
// personalizan por usuario en el servidor, y sin esto un visitante anónimo u
// otro cliente podría ver precios de una cuenta previa desde la caché.
const claveProductos = (
  uid: string | null,
  clienteId: string | null | undefined,
  busqueda: string,
  combustible: Combustible,
  categoria: string | null,
  marca: string | null,
  pagina: number
) =>
  `estufas.cache.productos.v1:${uid ?? 'anon'}:${clienteId ?? 'anon'}:${busqueda}|${combustible}|${categoria ?? ''}|${marca ?? ''}|${pagina}`;

// Catálogo con búsqueda y filtros. Todas las llamadas al backend viven aquí.
// `clienteId`: cuando un comercial crea un pedido para un cliente asignado,
// el catálogo muestra las condiciones de ESE cliente (validado en el RPC).
export function useCatalogo(clienteId?: string | null) {
  const { session } = useAuth();
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

  const claveProductosActual = claveProductos(
    uid,
    clienteId,
    busqueda,
    combustible,
    categoria,
    marca,
    pagina
  );
  const productos = claveMostrada === claveProductosActual ? productosBruto : [];
  const mostrandoCarga = cargando || claveMostrada !== claveProductosActual;

  // Filtros disponibles: se sirven desde caché (24 h). La red solo se consulta
  // cuando no hay dato o la entrada está caducada.
  React.useEffect(() => {
    let cancelado = false;

    void (async () => {
      const [cCat, cMar] = await Promise.all([
        cacheLeer<Categoria[]>(CLAVE_CATEGORIAS),
        cacheLeer<Marca[]>(CLAVE_MARCAS),
      ]);
      if (cancelado) return;
      if (cCat) setCategorias(cCat);
      if (cMar) setMarcas(cMar);

      const [edadCat, edadMar] = await Promise.all([
        cacheEdad(CLAVE_CATEGORIAS),
        cacheEdad(CLAVE_MARCAS),
      ]);
      if (cancelado) return;
      const catCaducada = cCat === null || edadCat === null || edadCat > TTL_FILTROS_MS;
      const marCaducada = cMar === null || edadMar === null || edadMar > TTL_FILTROS_MS;

      const [resCat, resMar] = await Promise.all([
        catCaducada
          ? supabase
              .from('categorias')
              .select('id,nombre,clave,grupo,orden,combustible')
              .eq('activo', true)
              .eq('borrado', false)
              .order('orden')
          : Promise.resolve(null),
        marCaducada
          ? supabase
              .from('marcas')
              .select('id,nombre')
              .eq('activo', true)
              .eq('borrado', false)
              .order('nombre')
          : Promise.resolve(null),
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
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  // Consulta con debounce y caché (stale-while-revalidate): si existe entrada
  // para estos filtros se pinta al instante sin spinner; la red se ejecuta
  // siempre y actualiza estado + caché al llegar.
  React.useEffect(() => {
    let cancelado = false;
    // Si la red responde antes que la caché, la caché NO debe pisar los
    // datos frescos (carrera caché-vs-red).
    let aplicadoRed = false;
    setError(null);
    setCargando(true);

    const clave = claveProductosActual;

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
  }, [busqueda, categoria, marca, pagina, clienteId, combustible, uid]);

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
  };
}
