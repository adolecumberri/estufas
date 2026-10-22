-- ============================================================================
-- 0013: Catálogo local (offline) — snapshot + descuentos de cuenta + versión
--
-- Contrato congelado para la app:
--   * fn_catalogo_version()  → INTEGER (versión actual del catálogo).
--   * fn_catalogo_snapshot() → JSONB con categorías/marcas/proveedores/
--     productos publicados con precio vigente (datos técnicos + combustibles
--     + precios de transporte incluidos).
--   * fn_descuentos_cuenta() → JSONB con los descuentos efectivos de la
--     cuenta (general/producto/combustible/promo) y los proveedores
--     habilitados del comercial efectivo.
--   * catalogo_version + trigger fn_bump_catalogo_version sobre las tablas
--     del catálogo. NO se versionan descuentos ni asignaciones de proveedor:
--     viajan en fn_descuentos_cuenta (no forman parte del snapshot).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Versión del catálogo (una sola fila).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalogo_version (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    version INTEGER NOT NULL DEFAULT 1,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO catalogo_version (id, version) VALUES (1, 1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION fn_catalogo_version()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    -- Clave de frescura diaria: los precios vigentes dependen de la fecha de
    -- negocio (fn_hoy/fecha_fin), así que la versión efectiva incluye los
    -- días desde epoch para invalidar cachés al cambiar de día.
    SELECT version + (SELECT (EXTRACT(EPOCH FROM now())::bigint / 86400)::int)
    FROM catalogo_version WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION fn_catalogo_version() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Snapshot completo del catálogo local.
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
        ) prods
    )
);
$$;

GRANT EXECUTE ON FUNCTION fn_catalogo_snapshot() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Descuentos de la cuenta + proveedores habilitados del comercial efectivo.
--    Permisos como fn_calcular_precio: cliente solo el propio; comercial solo
--    clientes asignados; admin todo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_descuentos_cuenta(p_cliente UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid        UUID := auth.uid();
    v_es_admin   BOOLEAN := fn_es_admin();
    v_cliente    UUID;
    v_general    NUMERIC;
    v_promo      NUMERIC := 0;
    v_comercial  UUID;
    v_proveedores JSONB := '[]'::jsonb;
BEGIN
    IF p_cliente IS NOT NULL
       AND NOT (v_es_admin OR p_cliente = v_uid OR fn_comercial_responsable(p_cliente)) THEN
        RAISE EXCEPTION 'Sin permiso para consultar las condiciones de ese cliente';
    END IF;

    -- Cliente efectivo: p_cliente para comercial/admin; el propio uid para un
    -- cliente; NULL para anónimo.
    IF v_es_admin OR fn_es_comercial() THEN
        v_cliente := p_cliente;
    ELSE
        v_cliente := v_uid;
    END IF;

    IF v_cliente IS NOT NULL THEN
        SELECT u.descuento_porcentaje INTO v_general FROM usuarios u WHERE u.id = v_cliente;

        SELECT COALESCE(MAX(descuento_porcentaje), 0) INTO v_promo
        FROM v_promociones_tienda_vigentes;
    END IF;

    -- Comercial efectivo para proveedores: cliente → su id_comercial;
    -- comercial → él mismo; admin sin p_cliente → todos los activos;
    -- anónimo → [].
    IF v_cliente IS NOT NULL THEN
        SELECT u.id_comercial INTO v_comercial FROM usuarios u WHERE u.id = v_cliente;
        IF v_comercial IS NOT NULL THEN
            SELECT COALESCE(jsonb_agg(cp.proveedor_id ORDER BY cp.proveedor_id), '[]'::jsonb)
            INTO v_proveedores
            FROM comercial_proveedor cp
            JOIN proveedores p ON p.id = cp.proveedor_id AND p.activo = TRUE AND p.borrado = FALSE
            WHERE cp.comercial_id = v_comercial AND cp.habilitado;
        END IF;
    ELSIF fn_es_comercial() THEN
        SELECT COALESCE(jsonb_agg(cp.proveedor_id ORDER BY cp.proveedor_id), '[]'::jsonb)
        INTO v_proveedores
        FROM comercial_proveedor cp
        JOIN proveedores p ON p.id = cp.proveedor_id AND p.activo = TRUE AND p.borrado = FALSE
        WHERE cp.comercial_id = v_uid AND cp.habilitado;
    ELSIF v_es_admin THEN
        SELECT COALESCE(jsonb_agg(p.id ORDER BY p.id), '[]'::jsonb)
        INTO v_proveedores
        FROM proveedores p
        WHERE p.activo = TRUE AND p.borrado = FALSE;
    END IF;

    RETURN jsonb_build_object(
        'cliente_id', to_jsonb(v_cliente),
        'general_pct', to_jsonb(v_general),
        'productos', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object('producto_id', d.producto_id, 'pct', d.descuento_porcentaje)
                ORDER BY d.producto_id
            ), '[]'::jsonb)
            FROM v_descuentos_cliente_producto_vigentes d
            WHERE d.cliente_id = v_cliente
        ),
        'combustibles', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object('combustible', d.combustible, 'pct', d.descuento_porcentaje)
                ORDER BY d.combustible
            ), '[]'::jsonb)
            FROM v_descuentos_cliente_combustible_vigentes d
            WHERE d.cliente_id = v_cliente
        ),
        'promo_pct', to_jsonb(v_promo),
        'proveedores_habilitados', v_proveedores
    );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_descuentos_cuenta(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_descuentos_cuenta(UUID) TO anon;

-- ---------------------------------------------------------------------------
-- 4. Bump de versión en cada cambio del catálogo (SECURITY DEFINER: el
--    UPDATE de catalogo_version lo ejecuta el owner aunque el DML lo haga
--    otro rol). Sin WHEN de columna: simple y robusto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_bump_catalogo_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE catalogo_version SET version = version + 1, actualizado_en = now() WHERE id = 1;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_catalogo_version_productos ON productos;
CREATE TRIGGER trg_catalogo_version_productos
AFTER INSERT OR UPDATE OR DELETE ON productos
FOR EACH STATEMENT EXECUTE FUNCTION fn_bump_catalogo_version();

DROP TRIGGER IF EXISTS trg_catalogo_version_precios ON producto_precios;
CREATE TRIGGER trg_catalogo_version_precios
AFTER INSERT OR UPDATE OR DELETE ON producto_precios
FOR EACH STATEMENT EXECUTE FUNCTION fn_bump_catalogo_version();

DROP TRIGGER IF EXISTS trg_catalogo_version_precios_transporte ON producto_precios_transporte;
CREATE TRIGGER trg_catalogo_version_precios_transporte
AFTER INSERT OR UPDATE OR DELETE ON producto_precios_transporte
FOR EACH STATEMENT EXECUTE FUNCTION fn_bump_catalogo_version();

DROP TRIGGER IF EXISTS trg_catalogo_version_producto_categoria ON producto_categoria;
CREATE TRIGGER trg_catalogo_version_producto_categoria
AFTER INSERT OR UPDATE OR DELETE ON producto_categoria
FOR EACH STATEMENT EXECUTE FUNCTION fn_bump_catalogo_version();

DROP TRIGGER IF EXISTS trg_catalogo_version_categorias ON categorias;
CREATE TRIGGER trg_catalogo_version_categorias
AFTER INSERT OR UPDATE OR DELETE ON categorias
FOR EACH STATEMENT EXECUTE FUNCTION fn_bump_catalogo_version();

DROP TRIGGER IF EXISTS trg_catalogo_version_marcas ON marcas;
CREATE TRIGGER trg_catalogo_version_marcas
AFTER INSERT OR UPDATE OR DELETE ON marcas
FOR EACH STATEMENT EXECUTE FUNCTION fn_bump_catalogo_version();

DROP TRIGGER IF EXISTS trg_catalogo_version_tipos ON tipos_producto;
CREATE TRIGGER trg_catalogo_version_tipos
AFTER INSERT OR UPDATE OR DELETE ON tipos_producto
FOR EACH STATEMENT EXECUTE FUNCTION fn_bump_catalogo_version();

DROP TRIGGER IF EXISTS trg_catalogo_version_proveedores ON proveedores;
CREATE TRIGGER trg_catalogo_version_proveedores
AFTER INSERT OR UPDATE OR DELETE ON proveedores
FOR EACH STATEMENT EXECUTE FUNCTION fn_bump_catalogo_version();

-- Las URLs de imagen/plano del snapshot salen de recursos: también versiona.
DROP TRIGGER IF EXISTS trg_catalogo_version_recursos ON recursos;
CREATE TRIGGER trg_catalogo_version_recursos
AFTER INSERT OR UPDATE OR DELETE ON recursos
FOR EACH STATEMENT EXECUTE FUNCTION fn_bump_catalogo_version();
