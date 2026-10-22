-- ============================================================================
-- 0016: Catálogo por proveedor — parámetro p_proveedor en fn_catalogo_usuario_v2
--
-- Añade un parámetro opcional p_proveedor AL FINAL (filtro por proveedor del
-- catálogo, usado por la vista de admin "catálogo por proveedor"). Copia de
-- la versión vigente de 0009 (columnas, visibilidad y filtros intactos) con
-- la única adición del filtro de proveedor.
-- ============================================================================

DROP FUNCTION IF EXISTS fn_catalogo_usuario_v2(TEXT, TEXT, UUID, UUID, INTEGER, INTEGER, UUID);

CREATE OR REPLACE FUNCTION fn_catalogo_usuario_v2(
    p_busqueda     TEXT DEFAULT NULL,
    p_combustible  TEXT DEFAULT NULL,
    p_categoria    UUID DEFAULT NULL,
    p_marca        UUID DEFAULT NULL,
    p_limite       INT DEFAULT 100,
    p_offset       INT DEFAULT 0,
    p_cliente      UUID DEFAULT NULL,
    p_proveedor    UUID DEFAULT NULL
)
RETURNS TABLE (
    producto_id        UUID,
    referencia         VARCHAR,
    nombre             VARCHAR,
    slug               VARCHAR,
    descripcion        TEXT,
    marca              VARCHAR,
    tipo               VARCHAR,
    categorias         TEXT[],
    etiqueta_energetica VARCHAR,
    destacado          BOOLEAN,
    precio_base        NUMERIC,
    precio_final       NUMERIC,
    descuento_pct      NUMERIC,
    descuento_origen   VARCHAR,
    moneda             CHAR,
    imagen_url         TEXT,
    proveedor_id       UUID,
    proveedor_nombre   VARCHAR,
    precios_transporte JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cliente   UUID;
    v_comercial UUID;
    v_todo      BOOLEAN := FALSE;
BEGIN
    -- Un comercial puede consultar el catálogo con las condiciones de un
    -- cliente asignado (para crear pedidos en su nombre).
    IF p_cliente IS NOT NULL
       AND NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente)) THEN
        RAISE EXCEPTION 'Sin permiso para consultar las condiciones de ese cliente';
    END IF;

    IF fn_es_comercial() OR fn_es_admin() THEN
        v_cliente := p_cliente; -- NULL => precios base
    ELSE
        v_cliente := auth.uid();
        IF v_cliente IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM usuarios WHERE id = v_cliente AND rol = 'cliente' AND borrado = FALSE) THEN
            v_cliente := NULL;
        END IF;
    END IF;

    -- Visibilidad por proveedor: anónimo y admin sin cliente objetivo ven
    -- todo (v_todo); cliente → su id_comercial; comercial → él mismo;
    -- admin con p_cliente → el id_comercial de ese cliente. Si el comercial
    -- efectivo es NULL, solo se ven productos sin proveedor asignado.
    IF auth.uid() IS NULL OR (fn_es_admin() AND v_cliente IS NULL) THEN
        v_todo := TRUE;
        v_comercial := NULL;
    ELSIF v_cliente IS NOT NULL THEN
        SELECT id_comercial INTO v_comercial FROM usuarios WHERE id = v_cliente;
    ELSIF fn_es_comercial() THEN
        v_comercial := auth.uid();
    ELSE
        v_comercial := NULL;
    END IF;

    IF p_limite IS NULL OR p_limite <= 0 OR p_limite > 2000 THEN p_limite := 2000; END IF;
    IF p_offset IS NULL OR p_offset < 0 THEN p_offset := 0; END IF;

    RETURN QUERY
    SELECT
        v.producto_id,
        v.referencia,
        v.nombre,
        v.slug,
        v.descripcion,
        m.nombre,
        t.nombre,
        ARRAY(
            SELECT c2.nombre
            FROM producto_categoria pc2
            JOIN categorias c2 ON c2.id = pc2.categoria_id AND c2.borrado = FALSE
            WHERE pc2.producto_id = v.producto_id AND pc2.borrado = FALSE
            ORDER BY c2.orden, c2.nombre
        )::text[],
        v.etiqueta_energetica,
        p.destacado,
        v.precio,
        COALESCE(d.precio_final, v.precio),
        COALESCE(d.descuento_pct, 0),
        COALESCE(d.descuento_origen, 'ninguno'),
        v.moneda,
        (SELECT r.url FROM recursos r WHERE r.id = v.imagen_principal_id),
        p.proveedor_id,
        pr.nombre,
        COALESCE((
            SELECT jsonb_build_object(
                    'camion',     to_jsonb(pt.camion),
                    'palet',      to_jsonb(pt.palet),
                    'franquicia', to_jsonb(pt.franquicia)
                )
                FROM v_precios_transporte pt
                WHERE pt.producto_id = v.producto_id
            ), '{}'::jsonb)
    FROM v_productos_precio_vigente v
    JOIN productos p ON p.id = v.producto_id
    LEFT JOIN marcas m ON m.id = p.marca_id
    LEFT JOIN tipos_producto t ON t.id = v.tipo_producto_id
    LEFT JOIN proveedores pr ON pr.id = p.proveedor_id AND pr.activo = TRUE AND pr.borrado = FALSE
    LEFT JOIN LATERAL fn_calcular_precio(v.producto_id, v_cliente) d ON TRUE
    WHERE v.precio IS NOT NULL
      AND (p_busqueda IS NULL
           OR v.nombre ILIKE '%' || p_busqueda || '%'
           OR v.referencia ILIKE '%' || p_busqueda || '%')
      AND (p_combustible IS NULL
           OR EXISTS (
               SELECT 1 FROM producto_categoria pc
               JOIN categorias c ON c.id = pc.categoria_id AND c.borrado = FALSE
               WHERE pc.producto_id = v.producto_id
                 AND pc.borrado = FALSE
                 AND c.combustible = p_combustible
           )
           OR NOT EXISTS (
               SELECT 1 FROM producto_categoria pc2
               JOIN categorias c2 ON c2.id = pc2.categoria_id AND c2.borrado = FALSE
               WHERE pc2.producto_id = v.producto_id
                 AND pc2.borrado = FALSE
                 AND c2.combustible IS NOT NULL
           ))
      AND (p_categoria IS NULL OR EXISTS (
            SELECT 1 FROM producto_categoria pc
            WHERE pc.producto_id = v.producto_id
              AND pc.categoria_id = p_categoria
              AND pc.borrado = FALSE
          ))
      AND (p_marca IS NULL OR p.marca_id = p_marca)
      AND (p_proveedor IS NULL OR p.proveedor_id = p_proveedor)
      AND (p.proveedor_id IS NULL
           OR (
               EXISTS (
                   SELECT 1 FROM proveedores prv
                   WHERE prv.id = p.proveedor_id
                     AND prv.activo = TRUE
                     AND prv.borrado = FALSE
               )
               AND (
                   v_todo
                   OR (v_comercial IS NOT NULL AND EXISTS (
                       SELECT 1 FROM comercial_proveedor cp
                       WHERE cp.comercial_id = v_comercial
                         AND cp.proveedor_id = p.proveedor_id
                         AND cp.habilitado
                   ))
               )
           ))
    ORDER BY p.destacado DESC, v.nombre ASC
    LIMIT p_limite OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_catalogo_usuario_v2(TEXT, TEXT, UUID, UUID, INTEGER, INTEGER, UUID, UUID)
TO anon, authenticated;
