-- ============================================================================
-- 0009: Datos técnicos flexibles (JSONB) + precios de transporte
--
-- * productos.datos: JSONB libre para "Datos técnicos" — array de grupos con
--   filas arbitrarias (clave/nombre/valor/unidad).
-- * producto_precios_transporte: camión / palet / franquicia por producto.
-- * Se exponen en la ficha (datos + precios) y los precios de transporte
--   también en el catálogo.
-- * Migra las características existentes de las estufas a productos.datos
--   (idempotente: solo productos con datos = '[]').
-- (DDL idempotente, estilo 0007: IF NOT EXISTS / DROP IF EXISTS.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columna flexible de datos técnicos.
-- ---------------------------------------------------------------------------
ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS datos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. Precios de transporte por producto.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producto_precios_transporte (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    transporte VARCHAR(20) NOT NULL
        CHECK (transporte IN ('camion', 'palet', 'franquicia')),
    precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_precios_transporte_activo
    ON producto_precios_transporte (producto_id, transporte) WHERE borrado = FALSE;
CREATE INDEX IF NOT EXISTS ix_ppt_producto
    ON producto_precios_transporte (producto_id) WHERE borrado = FALSE;

DROP TRIGGER IF EXISTS trg_producto_precios_transporte_updated_at ON producto_precios_transporte;
CREATE TRIGGER trg_producto_precios_transporte_updated_at
BEFORE UPDATE ON producto_precios_transporte
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE producto_precios_transporte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_precios_transporte_select ON producto_precios_transporte;
CREATE POLICY pol_precios_transporte_select ON producto_precios_transporte
    FOR SELECT
    USING (borrado = FALSE AND (fn_es_admin() OR auth.uid() IS NOT NULL));

DROP POLICY IF EXISTS pol_precios_transporte_insert ON producto_precios_transporte;
CREATE POLICY pol_precios_transporte_insert ON producto_precios_transporte
    FOR INSERT WITH CHECK (fn_es_admin());

DROP POLICY IF EXISTS pol_precios_transporte_update ON producto_precios_transporte;
CREATE POLICY pol_precios_transporte_update ON producto_precios_transporte
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

DROP POLICY IF EXISTS pol_precios_transporte_delete ON producto_precios_transporte;
CREATE POLICY pol_precios_transporte_delete ON producto_precios_transporte
    FOR DELETE USING (fn_es_admin());

-- ---------------------------------------------------------------------------
-- 3. Vista de precios de transporte vigentes (una fila por producto).
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_precios_transporte;
CREATE VIEW v_precios_transporte AS
SELECT producto_id,
       MAX(precio) FILTER (WHERE transporte = 'camion')     AS camion,
       MAX(precio) FILTER (WHERE transporte = 'palet')      AS palet,
       MAX(precio) FILTER (WHERE transporte = 'franquicia') AS franquicia
FROM producto_precios_transporte
WHERE borrado = FALSE
GROUP BY producto_id;

-- ---------------------------------------------------------------------------
-- 4. Migración de las características existentes a productos.datos.
--    Contrato: [{"grupo":"Datos técnicos","filas":[{"clave":...,"nombre":...,
--    "valor":...,"unidad":...}]}] — valores como número/string/booleano según
--    el tipo; 'unidad' presente siempre (null JSON si no tiene).
--    Idempotente: solo toca productos cuyo datos sigue vacío.
-- ---------------------------------------------------------------------------
UPDATE productos p
SET datos = COALESCE((
    SELECT jsonb_agg(
        jsonb_build_object('grupo', x.grupo, 'filas', x.filas)
        ORDER BY x.orden_min
    )
    FROM (
        SELECT
            c.grupo,
            MIN(c.orden) AS orden_min,
            jsonb_agg(
                jsonb_build_object(
                    'clave',  c.clave,
                    'nombre', c.nombre,
                    'unidad', to_jsonb(c.unidad),
                    'valor',  CASE c.tipo_dato
                        WHEN 'texto'    THEN to_jsonb(pc.valor_texto)
                        WHEN 'numero'   THEN to_jsonb(pc.valor_numero)
                        WHEN 'booleano' THEN to_jsonb(pc.valor_booleano)
                    END
                )
                ORDER BY c.orden, c.nombre
            ) AS filas
        FROM producto_caracteristica pc
        JOIN caracteristicas c ON c.id = pc.caracteristica_id
        WHERE pc.producto_id = p.id
          AND pc.borrado = FALSE
          AND c.borrado = FALSE
        GROUP BY c.grupo
    ) x
), '[]'::jsonb)
WHERE p.datos = '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 5. Ficha de producto (0007) + datos y precios de transporte.
--    (DROP primero: CREATE OR REPLACE no permite cambiar el tipo de retorno.)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_producto_detalle(UUID, UUID);

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
    WHERE v.producto_id = p_producto;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_producto_detalle(UUID, UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Catálogo (0007) + precios de transporte.
--    (DROP primero: CREATE OR REPLACE no permite cambiar el tipo de retorno.)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_catalogo_usuario_v2(TEXT, TEXT, UUID, UUID, INTEGER, INTEGER, UUID);

CREATE OR REPLACE FUNCTION fn_catalogo_usuario_v2(
    p_busqueda     TEXT DEFAULT NULL,
    p_combustible  TEXT DEFAULT NULL,
    p_categoria    UUID DEFAULT NULL,
    p_marca        UUID DEFAULT NULL,
    p_limite       INT DEFAULT 100,
    p_offset       INT DEFAULT 0,
    p_cliente      UUID DEFAULT NULL
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

GRANT EXECUTE ON FUNCTION fn_catalogo_usuario_v2(TEXT, TEXT, UUID, UUID, INTEGER, INTEGER, UUID)
TO anon, authenticated;
