-- ============================================================================
-- 0029: RPC fn_filtros_proveedor — combustibles y categorías de un proveedor
--
-- Fuente de datos del menú lateral del catálogo en el camino de RED (sin
-- SQLite): devuelve los combustibles presentes y las categorías de los
-- productos PUBLICADOS de un proveedor (o de todos si p_proveedor es NULL).
-- SECURITY DEFINER: replica la visibilidad del catálogo público (productos
-- activos y no borrados); la LISTA de proveedores que puede elegir cada
-- cuenta la sigue dando fn_proveedores_visibles (0007/0022).
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_filtros_proveedor(p_proveedor UUID DEFAULT NULL)
RETURNS TABLE (combustibles TEXT[], categorias JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        COALESCE(
            array_agg(DISTINCT c.combustible ORDER BY c.combustible)
                FILTER (WHERE c.combustible IS NOT NULL),
            '{}'::text[]
        ) AS combustibles,
        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', c2.id,
                        'nombre', c2.nombre,
                        'clave', c2.clave,
                        'grupo', c2.grupo,
                        'orden', c2.orden,
                        'combustible', c2.combustible
                    )
                    ORDER BY c2.orden, c2.nombre
                ),
                '[]'::jsonb
            )
            FROM categorias c2
            WHERE c2.borrado = FALSE
              AND c2.id IN (
                  SELECT DISTINCT pc.categoria_id
                  FROM productos p2
                  JOIN producto_categoria pc
                    ON pc.producto_id = p2.id AND pc.borrado = FALSE
                  WHERE p2.borrado = FALSE
                    AND p2.activo = TRUE
                    AND (p_proveedor IS NULL OR p2.proveedor_id = p_proveedor)
              )
        ) AS categorias
    FROM productos p
    LEFT JOIN producto_categoria pc
        ON pc.producto_id = p.id AND pc.borrado = FALSE
    LEFT JOIN categorias c
        ON c.id = pc.categoria_id AND c.borrado = FALSE
    WHERE p.borrado = FALSE
      AND p.activo = TRUE
      AND (p_proveedor IS NULL OR p.proveedor_id = p_proveedor)
$$;

GRANT EXECUTE ON FUNCTION fn_filtros_proveedor(UUID) TO anon, authenticated;
