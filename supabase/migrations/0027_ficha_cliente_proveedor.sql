-- ============================================================================
-- 0027: Ficha de cliente — categorías y productos POR PROVEEDOR
-- (docs/design/REQUISITOS_FICHA_CLIENTE.md §C)
--
-- * fn_categorias_proveedor(): categorías derivadas de los productos activos
--   del proveedor (producto_categoria ⋈ productos por proveedor_id),
--   deduplicadas y ordenadas por grupo/orden/nombre.
-- * fn_productos_proveedor(): productos con precio vigente de UN proveedor
--   para el buscador de descuentos por artículo; el precio final se calcula
--   con las condiciones del cliente (fn_calcular_precio).
--
-- Alcance (anillo 1, igual que los RPC 0026): el llamante debe ser admin o un
-- comercial que tenga el proveedor HABILITADO; para p_cliente se exige
-- fn_comercial_responsable (o admin). Sin esto, un comercial podría espiar
-- categorías/productos de proveedores ajenos.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_categorias_proveedor(p_proveedor UUID)
RETURNS TABLE (id UUID, nombre VARCHAR, clave VARCHAR, grupo VARCHAR, orden INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT (
        fn_es_admin()
        OR EXISTS (
            SELECT 1 FROM comercial_proveedor cp
            WHERE cp.comercial_id = auth.uid()
              AND cp.proveedor_id = p_proveedor
              AND cp.habilitado
        )
    ) THEN
        RAISE EXCEPTION 'Sin acceso a este proveedor';
    END IF;

    RETURN QUERY
    SELECT DISTINCT c.id, c.nombre, c.clave, c.grupo, c.orden
    FROM producto_categoria pc
    JOIN productos p ON p.id = pc.producto_id
    JOIN categorias c ON c.id = pc.categoria_id
    WHERE p.proveedor_id = p_proveedor
      AND p.activo = TRUE
      AND p.borrado = FALSE
      AND pc.borrado = FALSE
      AND c.activo = TRUE
      AND c.borrado = FALSE
    ORDER BY c.grupo, c.orden, c.nombre;
END;
$$;

CREATE OR REPLACE FUNCTION fn_productos_proveedor(
    p_cliente   UUID DEFAULT NULL,
    p_proveedor UUID DEFAULT NULL,
    p_busqueda  TEXT DEFAULT NULL,
    p_limite    INT DEFAULT 40
)
RETURNS TABLE (
    producto_id  UUID,
    referencia   VARCHAR,
    nombre       VARCHAR,
    precio_base  NUMERIC,
    precio_final NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_proveedor IS NULL THEN
        RAISE EXCEPTION 'El proveedor es obligatorio';
    END IF;

    -- Mismo alcance que fn_catalogo_usuario_v2 para el cliente objetivo.
    IF p_cliente IS NOT NULL
       AND NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente)) THEN
        RAISE EXCEPTION 'Sin permiso para consultar las condiciones de ese cliente';
    END IF;

    -- El proveedor debe estar habilitado para el comercial efectivo.
    IF NOT (
        fn_es_admin()
        OR EXISTS (
            SELECT 1 FROM comercial_proveedor cp
            WHERE cp.comercial_id = auth.uid()
              AND cp.proveedor_id = p_proveedor
              AND cp.habilitado
        )
    ) THEN
        RAISE EXCEPTION 'Sin acceso a este proveedor';
    END IF;

    IF p_limite IS NULL OR p_limite <= 0 OR p_limite > 100 THEN
        p_limite := 100;
    END IF;

    RETURN QUERY
    SELECT v.producto_id,
           v.referencia,
           v.nombre,
           v.precio,
           COALESCE(d.precio_final, v.precio)
    FROM v_productos_precio_vigente v
    JOIN productos p ON p.id = v.producto_id
    LEFT JOIN LATERAL fn_calcular_precio(v.producto_id, p_cliente) d ON TRUE
    WHERE p.proveedor_id = p_proveedor
      AND (p_busqueda IS NULL
           OR v.nombre ILIKE '%' || p_busqueda || '%'
           OR v.referencia ILIKE '%' || p_busqueda || '%')
    ORDER BY v.nombre ASC
    LIMIT p_limite;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_categorias_proveedor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_productos_proveedor(UUID, UUID, TEXT, INT) TO authenticated;
