-- ============================================================================
-- 0007: Modelo multi-empresa — proveedores
--
-- * Proveedores con productos asociados (productos.proveedor_id, opcional).
-- * Comerciales asociados a proveedores (habilitar/deshabilitar, admin).
-- * El catálogo y la ficha solo muestran productos cuyo proveedor esté
--   habilitado para el comercial del cliente (anónimo y admin ven todo).
-- * Los pedidos no mezclan proveedores: se validan en el servidor y el
--   proveedor se congela en el pedido al crearlo.
-- (DDL idempotente: permite re-aplicar tras un `migration repair`.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Proveedores.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(160) NOT NULL,
    nif VARCHAR(20),
    email VARCHAR(254),
    telefono VARCHAR(40),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_proveedores_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_proveedores_nombre_activo ON proveedores (lower(nombre)) WHERE borrado = FALSE;

DROP TRIGGER IF EXISTS trg_proveedores_updated_at ON proveedores;
CREATE TRIGGER trg_proveedores_updated_at
BEFORE UPDATE ON proveedores
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Productos asociados a proveedor (NULL = sin proveedor).
-- ---------------------------------------------------------------------------
ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES proveedores(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ix_productos_proveedor
    ON productos (proveedor_id) WHERE borrado = FALSE AND activo = TRUE;

-- ---------------------------------------------------------------------------
-- 3. Asignación comercial ↔ proveedor (sin borrado: desasignar = DELETE;
--    habilitar/deshabilitar = UPDATE habilitado).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comercial_proveedor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comercial_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    habilitado BOOLEAN NOT NULL DEFAULT TRUE,
    creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_comercial_proveedor UNIQUE (comercial_id, proveedor_id)
);

DROP TRIGGER IF EXISTS trg_comercial_proveedor_updated_at ON comercial_proveedor;
CREATE TRIGGER trg_comercial_proveedor_updated_at
BEFORE UPDATE ON comercial_proveedor
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. El pedido congela su proveedor al crearse.
-- ---------------------------------------------------------------------------
ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES proveedores(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 5. RLS (patrón 0002).
-- ---------------------------------------------------------------------------
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_proveedores_select ON proveedores;
CREATE POLICY pol_proveedores_select ON proveedores
    FOR SELECT
    USING (
        borrado = FALSE
        AND (fn_es_admin() OR (auth.uid() IS NOT NULL AND activo = TRUE))
    );

DROP POLICY IF EXISTS pol_proveedores_insert ON proveedores;
CREATE POLICY pol_proveedores_insert ON proveedores
    FOR INSERT WITH CHECK (fn_es_admin());

DROP POLICY IF EXISTS pol_proveedores_update ON proveedores;
CREATE POLICY pol_proveedores_update ON proveedores
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

DROP POLICY IF EXISTS pol_proveedores_delete ON proveedores;
CREATE POLICY pol_proveedores_delete ON proveedores
    FOR DELETE USING (fn_es_admin());

ALTER TABLE comercial_proveedor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_comercial_proveedor_select ON comercial_proveedor;
CREATE POLICY pol_comercial_proveedor_select ON comercial_proveedor
    FOR SELECT
    USING (fn_es_admin() OR comercial_id = auth.uid());

DROP POLICY IF EXISTS pol_comercial_proveedor_insert ON comercial_proveedor;
CREATE POLICY pol_comercial_proveedor_insert ON comercial_proveedor
    FOR INSERT WITH CHECK (fn_es_admin());

DROP POLICY IF EXISTS pol_comercial_proveedor_update ON comercial_proveedor;
CREATE POLICY pol_comercial_proveedor_update ON comercial_proveedor
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

DROP POLICY IF EXISTS pol_comercial_proveedor_delete ON comercial_proveedor;
CREATE POLICY pol_comercial_proveedor_delete ON comercial_proveedor
    FOR DELETE USING (fn_es_admin());

-- ---------------------------------------------------------------------------
-- 6. Funciones admin (SECURITY DEFINER, validan fn_es_admin(), con auditoría).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION crear_proveedor(
    p_nombre   VARCHAR DEFAULT NULL,
    p_nif      VARCHAR DEFAULT NULL,
    p_email    VARCHAR DEFAULT NULL,
    p_telefono VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF NOT fn_es_admin() THEN
        RAISE EXCEPTION 'Solo un administrador puede crear proveedores';
    END IF;
    IF p_nombre IS NULL OR btrim(p_nombre) = '' THEN
        RAISE EXCEPTION 'El nombre es obligatorio';
    END IF;

    INSERT INTO proveedores (nombre, nif, email, telefono)
    VALUES (p_nombre, p_nif, p_email, p_telefono)
    RETURNING id INTO v_id;

    INSERT INTO auditoria (tabla, registro_id, accion, realizado_por, datos_anteriores, datos_nuevos)
    VALUES ('proveedores', v_id, 'INSERT', auth.uid(), NULL,
            (SELECT to_jsonb(p) FROM proveedores p WHERE id = v_id));

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION actualizar_proveedor(
    p_proveedor UUID,
    p_nombre    VARCHAR DEFAULT NULL,
    p_nif       VARCHAR DEFAULT NULL,
    p_email     VARCHAR DEFAULT NULL,
    p_telefono  VARCHAR DEFAULT NULL,
    p_activo    BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_antes JSONB;
BEGIN
    IF NOT fn_es_admin() THEN
        RAISE EXCEPTION 'Solo un administrador puede actualizar proveedores';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM proveedores WHERE id = p_proveedor AND borrado = FALSE) THEN
        RAISE EXCEPTION 'Proveedor no encontrado';
    END IF;
    IF p_nombre IS NOT NULL AND btrim(p_nombre) = '' THEN
        RAISE EXCEPTION 'El nombre no puede quedar vacío';
    END IF;

    SELECT to_jsonb(p) INTO v_antes FROM proveedores p WHERE id = p_proveedor;

    UPDATE proveedores
    SET nombre    = COALESCE(p_nombre, nombre),
        nif       = COALESCE(p_nif, nif),
        email     = COALESCE(p_email, email),
        telefono  = COALESCE(p_telefono, telefono),
        activo    = COALESCE(p_activo, activo)
    WHERE id = p_proveedor;

    INSERT INTO auditoria (tabla, registro_id, accion, realizado_por, datos_anteriores, datos_nuevos)
    VALUES ('proveedores', p_proveedor, 'UPDATE', auth.uid(), v_antes,
            (SELECT to_jsonb(p) FROM proveedores p WHERE id = p_proveedor));
END;
$$;

CREATE OR REPLACE FUNCTION asignar_proveedor_comercial(p_comercial UUID, p_proveedor UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row UUID;
BEGIN
    IF NOT fn_es_admin() THEN
        RAISE EXCEPTION 'Solo un administrador puede asignar proveedores';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM usuarios WHERE id = p_comercial AND rol = 'comercial' AND borrado = FALSE
    ) THEN
        RAISE EXCEPTION 'El usuario no es un comercial activo';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM proveedores WHERE id = p_proveedor AND activo = TRUE AND borrado = FALSE
    ) THEN
        RAISE EXCEPTION 'El proveedor no existe o no está activo';
    END IF;

    INSERT INTO comercial_proveedor (comercial_id, proveedor_id, creado_por)
    VALUES (p_comercial, p_proveedor, auth.uid())
    ON CONFLICT (comercial_id, proveedor_id) DO NOTHING;

    SELECT id INTO v_row FROM comercial_proveedor
    WHERE comercial_id = p_comercial AND proveedor_id = p_proveedor;

    INSERT INTO auditoria (tabla, registro_id, accion, realizado_por, datos_anteriores, datos_nuevos)
    VALUES ('comercial_proveedor', v_row, 'asignar', auth.uid(), NULL,
            (SELECT to_jsonb(cp) FROM comercial_proveedor cp WHERE id = v_row));
END;
$$;

CREATE OR REPLACE FUNCTION desasignar_proveedor_comercial(p_comercial UUID, p_proveedor UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row   UUID;
    v_antes JSONB;
BEGIN
    IF NOT fn_es_admin() THEN
        RAISE EXCEPTION 'Solo un administrador puede desasignar proveedores';
    END IF;

    SELECT id, to_jsonb(cp) INTO v_row, v_antes
    FROM comercial_proveedor cp
    WHERE comercial_id = p_comercial AND proveedor_id = p_proveedor;

    DELETE FROM comercial_proveedor
    WHERE comercial_id = p_comercial AND proveedor_id = p_proveedor;

    IF v_row IS NOT NULL THEN
        INSERT INTO auditoria (tabla, registro_id, accion, realizado_por, datos_anteriores, datos_nuevos)
        VALUES ('comercial_proveedor', v_row, 'DELETE', auth.uid(), v_antes, NULL);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION habilitar_proveedor_comercial(
    p_comercial  UUID,
    p_proveedor  UUID,
    p_habilitado BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row   UUID;
    v_antes JSONB;
BEGIN
    IF NOT fn_es_admin() THEN
        RAISE EXCEPTION 'Solo un administrador puede habilitar proveedores';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM proveedores WHERE id = p_proveedor AND activo = TRUE AND borrado = FALSE
    ) THEN
        RAISE EXCEPTION 'El proveedor no existe o no está activo';
    END IF;

    SELECT id, to_jsonb(cp) INTO v_row, v_antes
    FROM comercial_proveedor cp
    WHERE comercial_id = p_comercial AND proveedor_id = p_proveedor;

    IF v_row IS NULL THEN
        RAISE EXCEPTION 'Asignación inexistente';
    END IF;

    UPDATE comercial_proveedor SET habilitado = p_habilitado WHERE id = v_row;

    INSERT INTO auditoria (tabla, registro_id, accion, realizado_por, datos_anteriores, datos_nuevos)
    VALUES ('comercial_proveedor', v_row, 'UPDATE', auth.uid(), v_antes,
            (SELECT to_jsonb(cp) FROM comercial_proveedor cp WHERE id = v_row));
END;
$$;

GRANT EXECUTE ON FUNCTION crear_proveedor(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION actualizar_proveedor(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION asignar_proveedor_comercial(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION desasignar_proveedor_comercial(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION habilitar_proveedor_comercial(UUID, UUID, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Catálogo: fn_catalogo_usuario_v2 (0005) + proveedor y visibilidad.
--    Anónimo y admin ven todo lo publicado; cliente/comercial ven solo los
--    productos sin proveedor o con proveedor habilitado para su comercial.
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
    proveedor_nombre   VARCHAR
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
        (SELECT r.url FROM recursos r WHERE r.id = v.imagen_principal_id),
        p.proveedor_id,
        pr.nombre
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

-- ---------------------------------------------------------------------------
-- 8. Ficha de producto: fn_producto_detalle (0003) + proveedor y visibilidad.
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
    proveedor_nombre    VARCHAR
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
        pr.nombre
    FROM v_productos_precio_vigente v
    JOIN productos p ON p.id = v.producto_id
    LEFT JOIN marcas m ON m.id = p.marca_id
    LEFT JOIN tipos_producto t ON t.id = v.tipo_producto_id
    LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
    LEFT JOIN LATERAL fn_calcular_precio(v.producto_id, v_cliente) d ON TRUE
    WHERE v.producto_id = p_producto;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Crear pedido: sin mezcla de proveedores y con el proveedor habilitado
--    para el comercial del cliente. El proveedor se congela en el pedido.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_pedido(
    p_cliente_id UUID DEFAULT NULL,
    p_lineas JSONB DEFAULT NULL,
    p_observaciones TEXT DEFAULT NULL
)
RETURNS TABLE (pedido_id UUID, numero_pedido BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid        UUID := auth.uid();
    v_rol        rol_usuario;
    v_cliente    UUID;
    v_pedido     UUID;
    v_proveedor  UUID;
    v_comercial  UUID;
    v_n_proveedores INT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Se requiere autenticación para crear pedidos';
    END IF;

    SELECT rol INTO v_rol FROM usuarios WHERE id = v_uid AND borrado = FALSE AND activo = TRUE;
    IF v_rol IS NULL THEN
        RAISE EXCEPTION 'El usuario no tiene perfil activo';
    END IF;

    IF v_rol = 'cliente' THEN
        IF p_cliente_id IS NOT NULL AND p_cliente_id <> v_uid THEN
            RAISE EXCEPTION 'Solo puedes crear pedidos propios';
        END IF;
        v_cliente := v_uid;
    ELSIF v_rol = 'comercial' THEN
        IF p_cliente_id IS NULL OR NOT fn_comercial_responsable(p_cliente_id) THEN
            RAISE EXCEPTION 'El comercial solo puede crear pedidos para clientes asignados';
        END IF;
        v_cliente := p_cliente_id;
    ELSIF v_rol = 'admin' THEN
        IF p_cliente_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM usuarios WHERE id = p_cliente_id AND rol = 'cliente' AND borrado = FALSE
        ) THEN
            RAISE EXCEPTION 'Cliente inválido para el pedido';
        END IF;
        v_cliente := p_cliente_id;
    END IF;

    -- Un solo proveedor por pedido (los productos sin proveedor no cuentan).
    IF p_lineas IS NOT NULL THEN
        SELECT COUNT(DISTINCT pr.proveedor_id) INTO v_n_proveedores
        FROM productos pr
        WHERE pr.id IN (SELECT (l->>'producto_id')::uuid FROM jsonb_array_elements(p_lineas) l)
          AND pr.proveedor_id IS NOT NULL;

        IF v_n_proveedores > 1 THEN
            RAISE EXCEPTION 'No se pueden mezclar proveedores en un pedido';
        END IF;

        SELECT DISTINCT pr.proveedor_id INTO v_proveedor
        FROM productos pr
        WHERE pr.id IN (SELECT (l->>'producto_id')::uuid FROM jsonb_array_elements(p_lineas) l)
          AND pr.proveedor_id IS NOT NULL;
    END IF;

    -- El proveedor debe existir, estar activo y habilitado para el comercial
    -- del cliente; sin comercial asignado no se admiten líneas con proveedor.
    IF v_proveedor IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM proveedores prv
            WHERE prv.id = v_proveedor AND prv.activo = TRUE AND prv.borrado = FALSE
        ) THEN
            RAISE EXCEPTION 'El proveedor no está disponible';
        END IF;

        SELECT id_comercial INTO v_comercial FROM usuarios WHERE id = v_cliente;
        IF v_comercial IS NULL THEN
            RAISE EXCEPTION 'El cliente no tiene comercial asignado';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM comercial_proveedor cp
            WHERE cp.comercial_id = v_comercial
              AND cp.proveedor_id = v_proveedor
              AND cp.habilitado
        ) THEN
            RAISE EXCEPTION 'El proveedor no está habilitado para este comercial';
        END IF;
    END IF;

    PERFORM set_config('app.nota_estado', 'Pedido creado', true);

    INSERT INTO pedidos (cliente_id, creado_por, comercial_id, observaciones, proveedor_id)
    VALUES (
        v_cliente,
        v_uid,
        (SELECT id_comercial FROM usuarios WHERE id = v_cliente),
        p_observaciones,
        v_proveedor
    )
    RETURNING id INTO v_pedido;

    INSERT INTO pedido_lineas (
        pedido_id, producto_id, referencia_producto, nombre_producto, cantidad,
        precio_unitario, descuento_porcentaje, descuento_origen, descuento_importe,
        iva_porcentaje, base_imponible, cuota_iva, total_linea
    )
    SELECT v_pedido, l.* FROM fn_calcular_lineas(v_cliente, p_lineas) l;

    RETURN QUERY SELECT p.id, p.numero_pedido FROM pedidos p WHERE p.id = v_pedido;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Editar pedido: misma validación de proveedor único y habilitado;
--     el pedido conserva su proveedor_id congelado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION editar_pedido(
    p_pedido UUID,
    p_lineas JSONB DEFAULT NULL,
    p_observaciones TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pedido    RECORD;
    v_uid       UUID := auth.uid();
    v_proveedor UUID;
    v_comercial UUID;
    v_n_proveedores INT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Se requiere autenticación';
    END IF;

    SELECT cliente_id, estado, creado_por, comercial_id, proveedor_id
    INTO v_pedido
    FROM pedidos WHERE id = p_pedido AND borrado = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido no encontrado';
    END IF;
    IF v_pedido.estado <> 'solicitado' THEN
        RAISE EXCEPTION 'Solo se pueden editar pedidos solicitados';
    END IF;

    IF NOT (fn_es_admin()
            OR v_pedido.cliente_id = v_uid
            OR fn_comercial_responsable(v_pedido.cliente_id)) THEN
        RAISE EXCEPTION 'Sin permiso para editar este pedido';
    END IF;

    -- Misma validación de proveedor que en crear_pedido.
    IF p_lineas IS NOT NULL THEN
        SELECT COUNT(DISTINCT pr.proveedor_id) INTO v_n_proveedores
        FROM productos pr
        WHERE pr.id IN (SELECT (l->>'producto_id')::uuid FROM jsonb_array_elements(p_lineas) l)
          AND pr.proveedor_id IS NOT NULL;

        IF v_n_proveedores > 1 THEN
            RAISE EXCEPTION 'No se pueden mezclar proveedores en un pedido';
        END IF;

        SELECT DISTINCT pr.proveedor_id INTO v_proveedor
        FROM productos pr
        WHERE pr.id IN (SELECT (l->>'producto_id')::uuid FROM jsonb_array_elements(p_lineas) l)
          AND pr.proveedor_id IS NOT NULL;
    END IF;

    IF v_proveedor IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM proveedores prv
            WHERE prv.id = v_proveedor AND prv.activo = TRUE AND prv.borrado = FALSE
        ) THEN
            RAISE EXCEPTION 'El proveedor no está disponible';
        END IF;

        SELECT id_comercial INTO v_comercial FROM usuarios WHERE id = v_pedido.cliente_id;
        IF v_comercial IS NULL THEN
            RAISE EXCEPTION 'El cliente no tiene comercial asignado';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM comercial_proveedor cp
            WHERE cp.comercial_id = v_comercial
              AND cp.proveedor_id = v_proveedor
              AND cp.habilitado
        ) THEN
            RAISE EXCEPTION 'El proveedor no está habilitado para este comercial';
        END IF;
    END IF;

    -- El proveedor del pedido queda congelado: las líneas nuevas no pueden
    -- cambiarlo (solo rellenarlo si el pedido aún no lo tenía).
    IF v_pedido.proveedor_id IS NOT NULL AND v_proveedor IS DISTINCT FROM v_pedido.proveedor_id THEN
        RAISE EXCEPTION 'No se puede cambiar el proveedor del pedido';
    END IF;
    IF v_pedido.proveedor_id IS NULL AND v_proveedor IS NOT NULL THEN
        UPDATE pedidos SET proveedor_id = v_proveedor WHERE id = p_pedido;
    END IF;

    PERFORM set_config('app.nota_estado', 'Pedido editado', true);

    UPDATE pedidos
    SET observaciones = COALESCE(p_observaciones, observaciones)
    WHERE id = p_pedido;

    DELETE FROM pedido_lineas WHERE pedido_id = p_pedido; -- auditado por trigger

    INSERT INTO pedido_lineas (
        pedido_id, producto_id, referencia_producto, nombre_producto, cantidad,
        precio_unitario, descuento_porcentaje, descuento_origen, descuento_importe,
        iva_porcentaje, base_imponible, cuota_iva, total_linea
    )
    SELECT p_pedido, l.* FROM fn_calcular_lineas(v_pedido.cliente_id, p_lineas) l;
END;
$$;
