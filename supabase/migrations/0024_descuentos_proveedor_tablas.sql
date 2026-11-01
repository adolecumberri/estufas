-- ============================================================================
-- 0024: Descuentos por proveedor y por categoría + historial de descuentos
--
-- Decisiones cerradas: (1) gana el MÁS PRECISO (producto > categoría >
-- proveedor > general, aunque el % sea menor); (2) "categoría" = tabla
-- categorias + producto_categoria, ACOTADA al proveedor del producto;
-- (3) no se acumulan (0% específico sustituye); (4) el admin puede escribir
-- descuentos de clientes de comerciales y TODO cambio queda en
-- descuentos_historial con el actor real y su rol.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tablas de descuentos por proveedor y por categoría (un solo descuento
--    activo por cliente+nivel; borrado lógico para el historial).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS descuentos_cliente_proveedor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    descuento_porcentaje NUMERIC(5,2) NOT NULL
        CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
    creado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    creado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    actualizado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_descuentos_cliente_proveedor_activo
    ON descuentos_cliente_proveedor (cliente_id, proveedor_id) WHERE borrado = FALSE;

CREATE TABLE IF NOT EXISTS descuentos_cliente_categoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    descuento_porcentaje NUMERIC(5,2) NOT NULL
        CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
    creado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    creado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    actualizado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_descuentos_cliente_categoria_activo
    ON descuentos_cliente_categoria (cliente_id, proveedor_id, categoria_id) WHERE borrado = FALSE;

-- ---------------------------------------------------------------------------
-- 2. Historial de descuentos (las 4 fuentes: general, proveedor, categoría,
--    producto). Solo inserciones: las escriben los triggers (SECURITY
--    DEFINER); nadie edita ni borra entradas.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS descuentos_historial (
    id BIGSERIAL PRIMARY KEY,
    cliente_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
    categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
    producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
    nivel TEXT NOT NULL CHECK (nivel IN ('general', 'proveedor', 'categoria', 'producto')),
    descuento_porcentaje NUMERIC(5,2),
    accion TEXT NOT NULL CHECK (accion IN ('crear', 'actualizar', 'anular')),
    actor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    actor_rol rol_usuario,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_descuentos_historial_cliente
    ON descuentos_historial (cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_descuentos_historial_fecha
    ON descuentos_historial (created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Triggers de historial (SECURITY DEFINER: escriben aunque el actor no
--    tenga permiso de INSERT sobre el historial; el actor real es
--    fn_app_user_id() = auth.uid() del llamante del RPC).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_historial_descuento_proveedor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_accion TEXT;
    v_actor  UUID := fn_app_user_id();
    v_pct    NUMERIC(5,2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_accion := 'anular';
        v_pct := OLD.descuento_porcentaje;
    ELSIF TG_OP = 'INSERT' THEN
        v_accion := 'crear';
        v_pct := NEW.descuento_porcentaje;
    ELSE
        v_accion := CASE WHEN NEW.borrado = TRUE AND OLD.borrado = FALSE THEN 'anular' ELSE 'actualizar' END;
        v_pct := NEW.descuento_porcentaje;
    END IF;

    INSERT INTO descuentos_historial (cliente_id, proveedor_id, nivel, descuento_porcentaje, accion, actor_id, actor_rol)
    VALUES (
        COALESCE(NEW.cliente_id, OLD.cliente_id),
        COALESCE(NEW.proveedor_id, OLD.proveedor_id),
        'proveedor',
        v_pct,
        v_accion,
        v_actor,
        (SELECT u.rol FROM usuarios u WHERE u.id = v_actor)
    );
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_historial_descuento_proveedor ON descuentos_cliente_proveedor;
CREATE TRIGGER trg_historial_descuento_proveedor
AFTER INSERT OR UPDATE OF descuento_porcentaje, borrado OR DELETE ON descuentos_cliente_proveedor
FOR EACH ROW EXECUTE FUNCTION fn_historial_descuento_proveedor();

CREATE OR REPLACE FUNCTION fn_historial_descuento_categoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_accion TEXT;
    v_actor  UUID := fn_app_user_id();
    v_pct    NUMERIC(5,2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_accion := 'anular';
        v_pct := OLD.descuento_porcentaje;
    ELSIF TG_OP = 'INSERT' THEN
        v_accion := 'crear';
        v_pct := NEW.descuento_porcentaje;
    ELSE
        v_accion := CASE WHEN NEW.borrado = TRUE AND OLD.borrado = FALSE THEN 'anular' ELSE 'actualizar' END;
        v_pct := NEW.descuento_porcentaje;
    END IF;

    INSERT INTO descuentos_historial (cliente_id, proveedor_id, categoria_id, nivel, descuento_porcentaje, accion, actor_id, actor_rol)
    VALUES (
        COALESCE(NEW.cliente_id, OLD.cliente_id),
        COALESCE(NEW.proveedor_id, OLD.proveedor_id),
        COALESCE(NEW.categoria_id, OLD.categoria_id),
        'categoria',
        v_pct,
        v_accion,
        v_actor,
        (SELECT u.rol FROM usuarios u WHERE u.id = v_actor)
    );
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_historial_descuento_categoria ON descuentos_cliente_categoria;
CREATE TRIGGER trg_historial_descuento_categoria
AFTER INSERT OR UPDATE OF descuento_porcentaje, borrado OR DELETE ON descuentos_cliente_categoria
FOR EACH ROW EXECUTE FUNCTION fn_historial_descuento_categoria();

CREATE OR REPLACE FUNCTION fn_historial_descuento_producto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_accion TEXT;
    v_actor  UUID := fn_app_user_id();
    v_pct    NUMERIC(5,2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_accion := 'anular';
        v_pct := OLD.descuento_porcentaje;
    ELSIF TG_OP = 'INSERT' THEN
        v_accion := 'crear';
        v_pct := NEW.descuento_porcentaje;
    ELSE
        v_accion := CASE WHEN NEW.borrado = TRUE AND OLD.borrado = FALSE THEN 'anular' ELSE 'actualizar' END;
        v_pct := NEW.descuento_porcentaje;
    END IF;

    INSERT INTO descuentos_historial (cliente_id, producto_id, nivel, descuento_porcentaje, accion, actor_id, actor_rol)
    VALUES (
        COALESCE(NEW.cliente_id, OLD.cliente_id),
        COALESCE(NEW.producto_id, OLD.producto_id),
        'producto',
        v_pct,
        v_accion,
        v_actor,
        (SELECT u.rol FROM usuarios u WHERE u.id = v_actor)
    );
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_historial_descuento_producto ON descuentos_cliente_producto;
CREATE TRIGGER trg_historial_descuento_producto
AFTER INSERT OR UPDATE OF descuento_porcentaje, borrado OR DELETE ON descuentos_cliente_producto
FOR EACH ROW EXECUTE FUNCTION fn_historial_descuento_producto();

-- General: cambios en usuarios.descuento_porcentaje (solo clientes).
CREATE OR REPLACE FUNCTION fn_historial_descuento_general()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_accion TEXT;
    v_actor  UUID := fn_app_user_id();
BEGIN
    IF NEW.rol <> 'cliente' THEN
        RETURN NEW;
    END IF;

    v_accion := CASE
        WHEN OLD.descuento_porcentaje = 0 AND NEW.descuento_porcentaje > 0 THEN 'crear'
        WHEN NEW.descuento_porcentaje = 0 AND OLD.descuento_porcentaje > 0 THEN 'anular'
        ELSE 'actualizar'
    END;

    INSERT INTO descuentos_historial (cliente_id, nivel, descuento_porcentaje, accion, actor_id, actor_rol)
    VALUES (
        NEW.id,
        'general',
        NEW.descuento_porcentaje,
        v_accion,
        v_actor,
        (SELECT u.rol FROM usuarios u WHERE u.id = v_actor)
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_historial_descuento_general ON usuarios;
CREATE TRIGGER trg_historial_descuento_general
AFTER UPDATE OF descuento_porcentaje ON usuarios
FOR EACH ROW EXECUTE FUNCTION fn_historial_descuento_general();

-- ---------------------------------------------------------------------------
-- 4. RLS (mismo patrón que descuentos_cliente_producto en 0002): el cliente
--    lee lo suyo; el comercial lee/escribe los de su cartera; el admin todo.
-- ---------------------------------------------------------------------------
ALTER TABLE descuentos_cliente_proveedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_descuentos_proveedor_select ON descuentos_cliente_proveedor
    FOR SELECT
    USING (
        borrado = FALSE
        AND (
            fn_es_admin()
            OR cliente_id = auth.uid()
            OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id))
        )
    );

CREATE POLICY pol_descuentos_proveedor_insert ON descuentos_cliente_proveedor
    FOR INSERT
    WITH CHECK (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)));

CREATE POLICY pol_descuentos_proveedor_update ON descuentos_cliente_proveedor
    FOR UPDATE
    USING (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)))
    WITH CHECK (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)));

CREATE POLICY pol_descuentos_proveedor_delete ON descuentos_cliente_proveedor
    FOR DELETE
    USING (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)));

ALTER TABLE descuentos_cliente_categoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_descuentos_categoria_select ON descuentos_cliente_categoria
    FOR SELECT
    USING (
        borrado = FALSE
        AND (
            fn_es_admin()
            OR cliente_id = auth.uid()
            OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id))
        )
    );

CREATE POLICY pol_descuentos_categoria_insert ON descuentos_cliente_categoria
    FOR INSERT
    WITH CHECK (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)));

CREATE POLICY pol_descuentos_categoria_update ON descuentos_cliente_categoria
    FOR UPDATE
    USING (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)))
    WITH CHECK (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)));

CREATE POLICY pol_descuentos_categoria_delete ON descuentos_cliente_categoria
    FOR DELETE
    USING (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)));

-- Historial: solo lectura (las escrituras las hacen los triggers SECURITY
-- DEFINER). Mismo alcance: cliente lo suyo, comercial su cartera, admin todo.
ALTER TABLE descuentos_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_historial_select ON descuentos_historial
    FOR SELECT
    USING (
        fn_es_admin()
        OR cliente_id = auth.uid()
        OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id))
    );

REVOKE INSERT, UPDATE, DELETE ON descuentos_historial FROM anon, authenticated;
