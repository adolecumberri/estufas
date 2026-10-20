-- ============================================================================
-- 0005: Catálogo — combustible de las categorías + filtro por combustible
--
-- Añade la dimensión "combustible" (pellets/lena) a las categorías y publica
-- fn_catalogo_usuario_v2: misma firma y resultado que fn_catalogo_usuario
-- (0003) con un parámetro adicional p_combustible y su filtro correspondiente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columna combustible en categorías. NULL = categoría sin combustible
--    (dimensiones transversales, p. ej. estilo).
-- ---------------------------------------------------------------------------
ALTER TABLE categorias
    ADD COLUMN combustible TEXT,
    ADD CONSTRAINT chk_categorias_combustible
        CHECK (combustible IN ('pellets', 'lena'));

-- ---------------------------------------------------------------------------
-- 2. Asignación de combustible a las categorías existentes.
-- ---------------------------------------------------------------------------
UPDATE categorias SET combustible = 'pellets'
WHERE clave IN ('pellet', 'aire', 'insertable', 'canalizada');

UPDATE categorias SET combustible = 'lena'
WHERE clave IN ('lena', 'fundicion', 'ventilada', 'hogares');

-- ---------------------------------------------------------------------------
-- 3. Nuevas categorías (mismos IDs que en seed.sql; ON CONFLICT para que un
--    `db reset` no duplique las filas que inserta el seed).
-- ---------------------------------------------------------------------------
INSERT INTO categorias (id, nombre, clave, grupo, orden, combustible) VALUES
('c1000000-0000-4000-8000-000000000009', 'Hidro',   'hidro',   'Instalación', 4, 'pellets'),
('c1000000-0000-4000-8000-000000000010', 'Estufas', 'estufas', 'Estilo',      3, 'lena')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. fn_catalogo_usuario_v2: catálogo con filtro por combustible.
--    Copia exacta de fn_catalogo_usuario (0003) + p_combustible.
-- ---------------------------------------------------------------------------
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
    imagen_url         TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cliente UUID;
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

    IF p_limite IS NULL OR p_limite <= 0 OR p_limite > 200 THEN p_limite := 200; END IF;
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
        (SELECT r.url FROM recursos r WHERE r.id = v.imagen_principal_id)
    FROM v_productos_precio_vigente v
    JOIN productos p ON p.id = v.producto_id
    LEFT JOIN marcas m ON m.id = p.marca_id
    LEFT JOIN tipos_producto t ON t.id = v.tipo_producto_id
    LEFT JOIN LATERAL fn_calcular_precio(v.producto_id, v_cliente) d ON TRUE
    WHERE v.precio IS NOT NULL
      AND (p_busqueda IS NULL
           OR v.nombre ILIKE '%' || p_busqueda || '%'
           OR v.referencia ILIKE '%' || p_busqueda || '%')
      AND (p_combustible IS NULL OR EXISTS (
            SELECT 1 FROM producto_categoria pc
            JOIN categorias c ON c.id = pc.categoria_id AND c.borrado = FALSE
            WHERE pc.producto_id = v.producto_id
              AND pc.borrado = FALSE
              AND c.combustible = p_combustible
          ))
      AND (p_categoria IS NULL OR EXISTS (
            SELECT 1 FROM producto_categoria pc
            WHERE pc.producto_id = v.producto_id
              AND pc.categoria_id = p_categoria
              AND pc.borrado = FALSE
          ))
      AND (p_marca IS NULL OR p.marca_id = p_marca)
    ORDER BY p.destacado DESC, v.nombre ASC
    LIMIT p_limite OFFSET p_offset;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Permisos (mismos roles que pueden ejecutar fn_catalogo_usuario).
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION fn_catalogo_usuario_v2(TEXT, TEXT, UUID, UUID, INTEGER, INTEGER, UUID)
TO anon, authenticated;
