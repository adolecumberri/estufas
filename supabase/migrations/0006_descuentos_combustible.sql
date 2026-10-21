-- ============================================================================
-- 0006: Descuentos por combustible por cliente
--
-- Precedencia de descuentos (PRD §6): producto > combustible > general >
-- promoción de tienda (la promo gana si su porcentaje es mayor). El descuento
-- por combustible sustituye al general del cliente para TODOS los productos
-- de ese combustible (pellets/lena según las categorías del producto).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabla de descuentos por cliente/combustible (espejo de
--    descuentos_cliente_producto, 0001, con combustible en vez de producto).
--    Una fila con 0% es válida y SUSTITUYE al descuento general del cliente
--    para ese combustible.
-- ---------------------------------------------------------------------------
CREATE TABLE descuentos_cliente_combustible (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    combustible TEXT NOT NULL
        CHECK (combustible IN ('pellets', 'lena')),
    descuento_porcentaje NUMERIC(5,2) NOT NULL
        CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
    fecha_inicio DATE NOT NULL DEFAULT fn_hoy(),
    fecha_fin DATE,
    creado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_descuento_combustible_fechas CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio),
    CONSTRAINT chk_descuento_cliente_combustible_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_descuentos_cliente_combustible_activo
    ON descuentos_cliente_combustible (cliente_id, combustible) WHERE borrado = FALSE;
CREATE INDEX ix_descuentos_cliente_combustible_cliente
    ON descuentos_cliente_combustible (cliente_id) WHERE borrado = FALSE;

-- Mismo validador que el descuento por producto: cliente activo con comercial.
CREATE TRIGGER trg_descuentos_cliente_combustible_validar
BEFORE INSERT OR UPDATE OF cliente_id ON descuentos_cliente_combustible
FOR EACH ROW EXECUTE FUNCTION fn_descuento_cliente_validar();

CREATE TRIGGER trg_descuentos_cliente_combustible_updated_at
BEFORE UPDATE ON descuentos_cliente_combustible
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Vista de descuentos por combustible efectivos hoy (espejo de la vista
--    de producto; la usan las funciones SECURITY DEFINER).
-- ---------------------------------------------------------------------------
CREATE VIEW v_descuentos_cliente_combustible_vigentes AS
SELECT cliente_id, combustible, descuento_porcentaje, fecha_inicio
FROM descuentos_cliente_combustible
WHERE borrado = FALSE
  AND fecha_inicio <= fn_hoy()
  AND (fecha_fin IS NULL OR fecha_fin > fn_hoy());

-- ---------------------------------------------------------------------------
-- 3. RPCs de gestión (espejo de asignar/anular_descuento_cliente_producto,
--    0003): admin o comercial responsable. Con trazabilidad.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION asignar_descuento_cliente_combustible(
    p_cliente_id    UUID,
    p_combustible   TEXT,
    p_descuento_pct NUMERIC,
    p_fecha_fin     DATE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row UUID;
BEGIN
    IF p_combustible IS NULL OR p_combustible NOT IN ('pellets', 'lena') THEN
        RAISE EXCEPTION 'Combustible inválido';
    END IF;
    IF p_descuento_pct IS NULL OR p_descuento_pct < 0 OR p_descuento_pct > 100 THEN
        RAISE EXCEPTION 'Descuento fuera de rango';
    END IF;
    IF NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente_id)) THEN
        RAISE EXCEPTION 'Sin permiso para modificar descuentos de este cliente';
    END IF;
    IF p_fecha_fin IS NOT NULL AND p_fecha_fin <= fn_hoy() THEN
        RAISE EXCEPTION 'La fecha de fin debe ser futura';
    END IF;

    INSERT INTO descuentos_cliente_combustible (cliente_id, combustible, descuento_porcentaje, fecha_fin, creado_por)
    VALUES (p_cliente_id, p_combustible, round(p_descuento_pct, 2), p_fecha_fin, auth.uid())
    RETURNING id INTO v_row;

    INSERT INTO auditoria (tabla, registro_id, accion, realizado_por, datos_anteriores, datos_nuevos)
    VALUES ('descuentos_cliente_combustible', v_row, 'INSERT', auth.uid(), NULL,
            (SELECT to_jsonb(d) FROM descuentos_cliente_combustible d WHERE id = v_row));
END;
$$;

CREATE OR REPLACE FUNCTION anular_descuento_cliente_combustible(
    p_cliente_id  UUID,
    p_combustible TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente_id)) THEN
        RAISE EXCEPTION 'Sin permiso para modificar descuentos de este cliente';
    END IF;

    UPDATE descuentos_cliente_combustible
    SET borrado = TRUE, deleted_at = now(), deleted_by = auth.uid()
    WHERE cliente_id = p_cliente_id
      AND combustible = p_combustible
      AND borrado = FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION asignar_descuento_cliente_combustible(UUID, TEXT, NUMERIC, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION anular_descuento_cliente_combustible(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. fn_calcular_precio (0003) + descuento por combustible.
--    Precedencia: producto > combustible > general > promoción (max).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calcular_precio(p_producto UUID, p_cliente UUID DEFAULT NULL)
RETURNS TABLE (
    precio_base NUMERIC,
    descuento_pct NUMERIC,
    descuento_origen VARCHAR,
    precio_final NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_base   NUMERIC(12,2);
    v_gen    NUMERIC(5,2) := 0;
    v_esp    NUMERIC(5,2);
    v_comb   NUMERIC(5,2);
    v_promo  NUMERIC(5,2) := 0;
    v_disc   NUMERIC(5,2) := 0;
    v_origen VARCHAR(30) := 'ninguno';
    v_uid    UUID := auth.uid();
BEGIN
    IF p_cliente IS NOT NULL THEN
        IF NOT (fn_es_admin() OR p_cliente = v_uid OR fn_comercial_responsable(p_cliente)) THEN
            RAISE EXCEPTION 'Sin permiso para consultar las condiciones de ese cliente';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM usuarios WHERE id = p_cliente AND rol = 'cliente' AND borrado = FALSE
        ) THEN
            RAISE EXCEPTION 'El cliente % no existe o no está activo', p_cliente;
        END IF;
    END IF;

    SELECT precio INTO v_base
    FROM v_productos_precio_vigente
    WHERE producto_id = p_producto;

    IF v_base IS NULL THEN
        RAISE EXCEPTION 'El producto % no está publicado o no tiene precio vigente', p_producto;
    END IF;

    IF p_cliente IS NOT NULL THEN
        SELECT descuento_porcentaje INTO v_gen
        FROM usuarios WHERE id = p_cliente;

        SELECT descuento_porcentaje INTO v_esp
        FROM v_descuentos_cliente_producto_vigentes
        WHERE cliente_id = p_cliente AND producto_id = p_producto;

        SELECT descuento_porcentaje INTO v_comb
        FROM v_descuentos_cliente_combustible_vigentes d
        WHERE d.cliente_id = p_cliente
          AND d.combustible = (
              SELECT c.combustible
              FROM producto_categoria pc
              JOIN categorias c ON c.id = pc.categoria_id AND c.borrado = FALSE
              WHERE pc.producto_id = p_producto
                AND pc.borrado = FALSE
                AND c.combustible IS NOT NULL
              LIMIT 1
          );

        SELECT COALESCE(MAX(descuento_porcentaje), 0) INTO v_promo
        FROM v_promociones_tienda_vigentes;

        IF v_esp IS NOT NULL THEN
            v_disc := v_esp;
            v_origen := 'cliente_producto';
        ELSIF v_comb IS NOT NULL THEN
            v_disc := v_comb;
            v_origen := 'cliente_combustible';
        ELSIF v_gen > 0 THEN
            v_disc := v_gen;
            v_origen := 'cliente_general';
        END IF;

        IF v_promo > v_disc THEN
            v_disc := v_promo;
            v_origen := 'promocion_tienda';
        END IF;
    END IF;

    precio_base := v_base;
    descuento_pct := v_disc;
    descuento_origen := v_origen;
    precio_final := round(v_base * (1 - v_disc / 100.0), 2);
    RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS y permisos (equivalentes a los de descuentos_cliente_producto, 0002).
-- ---------------------------------------------------------------------------
ALTER TABLE descuentos_cliente_combustible ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_descuentos_combustible_select ON descuentos_cliente_combustible
    FOR SELECT
    USING (
        borrado = FALSE
        AND (
            fn_es_admin()
            OR cliente_id = auth.uid()
            OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id))
        )
    );

CREATE POLICY pol_descuentos_combustible_insert ON descuentos_cliente_combustible
    FOR INSERT
    WITH CHECK (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)));

CREATE POLICY pol_descuentos_combustible_update ON descuentos_cliente_combustible
    FOR UPDATE
    USING (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)))
    WITH CHECK (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)));

-- La vista solo la usan las funciones SECURITY DEFINER (igual que la de producto).
REVOKE ALL ON v_descuentos_cliente_combustible_vigentes FROM anon, authenticated;
