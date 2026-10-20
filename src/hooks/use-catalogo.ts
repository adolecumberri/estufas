import * as React from 'react';

import { PAGINACION } from '@/constants';
import { supabase } from '@/lib/supabase';
import type { Categoria, Combustible, Marca, ProductoCatalogo } from '@/lib/types';

const DEBOUNCE_MS = 300;

// Catálogo con búsqueda y filtros. Todas las llamadas al backend viven aquí.
// `clienteId`: cuando un comercial crea un pedido para un cliente asignado,
// el catálogo muestra las condiciones de ESE cliente (validado en el RPC).
export function useCatalogo(clienteId?: string | null) {
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

  const [productos, setProductos] = React.useState<ProductoCatalogo[]>([]);
  const [categorias, setCategorias] = React.useState<Categoria[]>([]);
  const [marcas, setMarcas] = React.useState<Marca[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [hayMas, setHayMas] = React.useState(false);

  // Filtros disponibles (una sola carga).
  React.useEffect(() => {
    void (async () => {
      const [resCat, resMar] = await Promise.all([
        supabase.from('categorias').select('id,nombre,clave,grupo,orden,combustible').eq('activo', true).eq('borrado', false).order('orden'),
        supabase.from('marcas').select('id,nombre').eq('activo', true).eq('borrado', false).order('nombre'),
      ]);
      if (!resCat.error) setCategorias((resCat.data as Categoria[]) ?? []);
      if (!resMar.error) setMarcas((resMar.data as Marca[]) ?? []);
    })();
  }, []);

  // Consulta con debounce.
  React.useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);

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
          setCargando(false);
          return;
        }
        const filas = (data ?? []) as ProductoCatalogo[];
        setHayMas(filas.length > PAGINACION.catalogo);
        setProductos(filas.slice(0, PAGINACION.catalogo));
        setCargando(false);
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [busqueda, categoria, marca, pagina, clienteId, combustible]);

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
    cargando,
    error,
    limpiarFiltros,
  };
}
