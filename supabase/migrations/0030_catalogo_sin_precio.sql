-- ============================================================================
-- 0030: el catálogo NUNCA devuelve productos sin precio vigente
--
-- Bug: 17 productos Eider activos (EID-031..078) sin ninguna fila en
-- producto_precios aparecían en fn_producto_detalle con precio NULL (la vista
-- v_productos_precio_vigente usa LEFT JOIN) y la app fallaba al añadirlos.
-- fn_catalogo_snapshot y fn_catalogo_usuario_v2 ya los excluían vía
-- `v.precio IS NOT NULL`, pero el invariante queda ahora EXPLÍCITO con un
-- AND EXISTS en las tres funciones (idempotente: CREATE OR REPLACE; copias de
-- las versiones vigentes 0013/0016/0009 con esa única adición).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. fn_catalogo_snapshot (0013) + EXISTS de precio vigente.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_catalogo_snapshot()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT jsonb_build_object(
    'version', (SELECT version + (SELECT (EXTRACT(EPOCH FROM now())::bigint / 86400)::int)
                FROM catalogo_version WHERE id = 1),
    'categorias', (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id',          c.id,
                'nombre',      c.nombre,
                'clave',       c.clave,
                'grupo',       c.grupo,
                'orden',       c.orden,
                'combustible', to_jsonb(c.combustible)
            )
            ORDER BY c.orden, c.nombre
        ), '[]'::jsonb)
        FROM categorias c
        WHERE c.activo = TRUE AND c.borrado = FALSE
    ),
    'marcas', (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object('id', m.id, 'nombre', m.nombre)
            ORDER BY m.nombre
        ), '[]'::jsonb)
        FROM marcas m
        WHERE m.activo = TRUE AND m.borrado = FALSE
    ),
    'proveedores', (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object('id', p.id, 'nombre', p.nombre)
            ORDER BY p.nombre
        ), '[]'::jsonb)
        FROM proveedores p
        WHERE p.activo = TRUE AND p.borrado = FALSE
    ),
    'productos', (
        SELECT COALESCE(jsonb_agg(prod_obj ORDER BY ord1 DESC, ord2), '[]'::jsonb)
        FROM (
            SELECT
                jsonb_build_object(
                    'producto_id',         v.producto_id,
                    'referencia',          v.referencia,
                    'nombre',              v.nombre,
                    'slug',                to_jsonb(v.slug),
                    'descripcion',         to_jsonb(v.descripcion),
                    'tipo',                to_jsonb(t.nombre),
                    'marca_id',            to_jsonb(p.marca_id),
                    'proveedor_id',        to_jsonb(p.proveedor_id),
                    'proveedor_nombre',    to_jsonb(pr.nombre),
                    'activo',              p.activo,
                    'destacado',           p.destacado,
                    'etiqueta_energetica', to_jsonb(v.etiqueta_energetica),
                    'imagen_url',          to_jsonb((SELECT r.url FROM recursos r WHERE r.id = v.imagen_principal_id)),
                    'plano_url',           to_jsonb((SELECT r.url FROM recursos r WHERE r.id = v.imagen_plano_id)),
                    'precio_base',         v.precio,
                    'precios_transporte',  COALESCE((
                        SELECT jsonb_build_object(
                            'camion',     to_jsonb(pt.camion),
                            'palet',      to_jsonb(pt.palet),
                            'franquicia', to_jsonb(pt.franquicia)
                        )
                        FROM v_precios_transporte pt
                        WHERE pt.producto_id = v.producto_id
                    ), '{}'::jsonb),
                    'combustibles', (
                        SELECT COALESCE(jsonb_agg(DISTINCT c.combustible), '[]'::jsonb)
                        FROM producto_categoria pc
                        JOIN categorias c ON c.id = pc.categoria_id AND c.borrado = FALSE
                        WHERE pc.producto_id = v.producto_id
                          AND pc.borrado = FALSE
                          AND c.combustible IS NOT NULL
                    ),
                    'categorias', (
                        SELECT COALESCE(jsonb_agg(pc.categoria_id ORDER BY c.orden, c.nombre), '[]'::jsonb)
                        FROM producto_categoria pc
                        JOIN categorias c ON c.id = pc.categoria_id AND c.borrado = FALSE
                        WHERE pc.producto_id = v.producto_id AND pc.borrado = FALSE
                    ),
                    'datos', p.datos,
                    'galeria', (
                        SELECT COALESCE(jsonb_agg(
                            jsonb_build_object(
                                'url', r.url, 'alt', r.texto_alternativo,
                                'tipo', pr.tipo_en_producto, 'orden', pr.orden
                            ) ORDER BY pr.orden
                        ), '[]'::jsonb)
                        FROM producto_recurso pr
                        JOIN recursos r ON r.id = pr.recurso_id
                        WHERE pr.producto_id = v.producto_id
                          AND pr.borrado = FALSE AND r.borrado = FALSE
                    )
                ) AS prod_obj,
                p.destacado AS ord1,
                v.nombre    AS ord2
            FROM v_productos_precio_vigente v
            JOIN productos p ON p.id = v.producto_id
            LEFT JOIN tipos_producto t ON t.id = v.tipo_producto_id
            LEFT JOIN proveedores pr ON pr.id = p.proveedor_id AND pr.activo = TRUE AND pr.borrado = FALSE
            WHERE p.activo = TRUE
              AND p.borrado = FALSE
              AND v.precio IS NOT NULL
              -- 0030: invariante explícito — el producto tiene precio vigente.
              AND EXISTS (
                  SELECT 1 FROM producto_precios pr
                  WHERE pr.producto_id = p.id
                    AND pr.borrado = FALSE
                    AND pr.fecha_inicio <= now()
                    AND (pr.fecha_fin IS NULL OR pr.fecha_fin > now())
              )
              -- Coherencia con la visibilidad del catálogo (0007): un producto
              -- con proveedor inactivo o borrado NO se publica en el snapshot
              -- (el LEFT JOIN de arriba solo sirve para el nombre).
              AND (
                  p.proveedor_id IS NULL
                  OR EXISTS (
                      SELECT 1 FROM proveedores prv
                      WHERE prv.id = p.proveedor_id
                        AND prv.activo = TRUE
                        AND prv.borrado = FALSE
                  )
              )
        ) prods
    )
);
$$;

-- ---------------------------------------------------------------------------
-- 2. fn_catalogo_usuario_v2 (0016, con p_proveedor) + EXISTS de precio vigente.
-- ---------------------------------------------------------------------------
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
      -- 0030: invariante explícito — el producto tiene precio vigente.
      AND EXISTS (
          SELECT 1 FROM producto_precios pr
          WHERE pr.producto_id = p.id
            AND pr.borrado = FALSE
            AND pr.fecha_inicio <= now()
            AND (pr.fecha_fin IS NULL OR pr.fecha_fin > now())
      )
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

-- ---------------------------------------------------------------------------
-- 3. fn_producto_detalle (0009) + EXISTS de precio vigente.
--    (Aquí estaba el fallo real: el detalle devolvía el producto con precio
--    NULL — el LEFT JOIN de la vista — y la app fallaba al añadirlo.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_producto_detalle(p_producto UUID, p_cliente UUID DEFAULT NULL)
RETURNS TABLE (
    producto_id         UUID,
    referencia          VARCHAR,
    nombre              VARCHAR,
    slug                VARCHAR,
    descripcion         TEXT,
    marca               VARCHAR,
    tipo                VARCHAR,
    categorias          TEXT[],
    etiqueta_energetica VARCHAR,
    destacado           BOOLEAN,
    precio_base         NUMERIC,
    precio_final        NUMERIC,
    descuento_pct       NUMERIC,
    descuento_origen    VARCHAR,
    moneda              CHAR,
    imagen_url          TEXT,
    plano_url           TEXT,
    caracteristicas     JSONB,
    galeria             JSONB,
    proveedor_id        UUID,
    proveedor_nombre    VARCHAR,
    datos               JSONB,
    precios_transporte  JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cliente   UUID;
    v_comercial UUID;
    v_proveedor UUID;
    v_todo      BOOLEAN := FALSE;
BEGIN
    IF NOT (fn_es_admin() OR EXISTS (
        SELECT 1 FROM productos WHERE id = p_producto AND borrado = FALSE AND activo = TRUE
    )) THEN
        RETURN; -- sin filas: producto no publicado
    END IF;

    IF p_cliente IS NOT NULL
       AND NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente)) THEN
        RAISE EXCEPTION 'Sin permiso para consultar las condiciones de ese cliente';
    END IF;

    IF fn_es_comercial() OR fn_es_admin() THEN
        v_cliente := p_cliente;
    ELSE
        v_cliente := auth.uid();
    END IF;

    -- Visibilidad por proveedor: anónimo y admin sin cliente objetivo ven
    -- todo; cliente → su id_comercial; comercial → él mismo; admin con
    -- p_cliente → el id_comercial de ese cliente. El proveedor debe estar
    -- activo y no borrado; si el comercial efectivo es NULL o no lo tiene
    -- habilitado, el producto no está disponible.
    SELECT pr.proveedor_id INTO v_proveedor FROM productos pr WHERE pr.id = p_producto;
    IF v_proveedor IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM proveedores prv
            WHERE prv.id = v_proveedor AND prv.activo = TRUE AND prv.borrado = FALSE
        ) THEN
            RAISE EXCEPTION 'Producto no disponible';
        END IF;

        IF auth.uid() IS NULL OR (fn_es_admin() AND v_cliente IS NULL) THEN
            v_todo := TRUE;
        ELSIF v_cliente IS NOT NULL THEN
            SELECT id_comercial INTO v_comercial FROM usuarios WHERE id = v_cliente;
        ELSIF fn_es_comercial() THEN
            v_comercial := auth.uid();
        ELSE
            v_comercial := NULL;
        END IF;

        IF NOT v_todo AND (v_comercial IS NULL OR NOT EXISTS (
            SELECT 1 FROM comercial_proveedor cp
            WHERE cp.comercial_id = v_comercial
              AND cp.proveedor_id = v_proveedor
              AND cp.habilitado
        )) THEN
            RAISE EXCEPTION 'Producto no disponible';
        END IF;
    END IF;

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
        (SELECT r.url FROM recursos r WHERE r.id = v.imagen_plano_id),
        (
            SELECT COALESCE(jsonb_agg(j), '[]'::jsonb)
            FROM (
                SELECT jsonb_build_object(
                    'clave',  c.clave,
                    'nombre', c.nombre,
                    'unidad', c.unidad,
                    'grupo',  c.grupo,
                    'orden',  c.orden,
                    'valor',  CASE c.tipo_dato
                        WHEN 'texto'    THEN to_jsonb(pcv.valor_texto)
                        WHEN 'numero'   THEN to_jsonb(pcv.valor_numero)
                        WHEN 'booleano' THEN to_jsonb(pcv.valor_booleano)
                    END
                ) AS j
                FROM producto_caracteristica pcv
                JOIN caracteristicas c ON c.id = pcv.caracteristica_id
                WHERE pcv.producto_id = v.producto_id
                  AND pcv.borrado = FALSE AND c.borrado = FALSE
                ORDER BY c.grupo, c.orden, c.nombre
            ) x
        ),
        (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'url', r.url, 'alt', r.texto_alternativo,
                    'tipo', pr.tipo_en_producto, 'orden', pr.orden
                ) ORDER BY pr.orden
            ), '[]'::jsonb)
            FROM producto_recurso pr
            JOIN recursos r ON r.id = pr.recurso_id
            WHERE pr.producto_id = v.producto_id
              AND pr.borrado = FALSE AND r.borrado = FALSE
        ),
        p.proveedor_id,
        pr.nombre,
        p.datos,
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
    WHERE v.producto_id = p_producto
      -- 0030: invariante explícito — el producto tiene precio vigente; sin
      -- esta guarda el LEFT JOIN de la vista devolvía el detalle con precio
      -- NULL y la app fallaba al añadirlo.
      AND EXISTS (
          SELECT 1 FROM producto_precios pp
          WHERE pp.producto_id = p.id
            AND pp.borrado = FALSE
            AND pp.fecha_inicio <= now()
            AND (pp.fecha_fin IS NULL OR pp.fecha_fin > now())
      );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_producto_detalle(UUID, UUID) TO anon, authenticated;
