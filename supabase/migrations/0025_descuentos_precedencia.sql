-- ============================================================================
-- 0025: Precedencia de descuentos — producto > categoría > proveedor > general
--
-- Decisiones cerradas: gana el MÁS PRECISO aunque el % sea menor; "categoría"
-- está acotada al proveedor del producto; no se acumulan (0% específico
-- sustituye); las promos de tienda se mantienen como ÚLTIMO RECURSO con el
-- comportamiento actual (ganan solo si su % es MAYOR que el descuento
-- elegido). El nivel "combustible" (0006) queda FUERA de la cadena: la tabla
-- se conserva por compatibilidad de datos, pero ya no se consulta.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. pedido_lineas.descuento_origen admite los orígenes nuevos.
-- ---------------------------------------------------------------------------
ALTER TABLE pedido_lineas
    DROP CONSTRAINT IF EXISTS chk_pedido_lineas_descuento_origen;
ALTER TABLE pedido_lineas
    DROP CONSTRAINT IF EXISTS pedido_lineas_descuento_origen_check;

ALTER TABLE pedido_lineas
    ADD CONSTRAINT chk_pedido_lineas_descuento_origen
        CHECK (descuento_origen IN (
            'ninguno',
            'cliente_general',
            'cliente_producto',
            'cliente_combustible',
            'cliente_categoria',
            'cliente_proveedor',
            'promocion_tienda',
            'ajuste_comercial'
        ));

-- ---------------------------------------------------------------------------
-- 2. fn_calcular_precio: producto > categoría > proveedor > general > promo.
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
    v_cat    NUMERIC(5,2);
    v_prov   NUMERIC(5,2);
    v_promo  NUMERIC(5,2) := 0;
    v_disc   NUMERIC(5,2) := 0;
    v_origen VARCHAR(30) := 'ninguno';
    v_uid    UUID := auth.uid();
    v_proveedor_producto UUID;
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

        -- Categoría y proveedor: acotados al proveedor del producto.
        SELECT pr.proveedor_id INTO v_proveedor_producto
        FROM productos pr
        WHERE pr.id = p_producto;

        IF v_proveedor_producto IS NOT NULL THEN
            SELECT d.descuento_porcentaje INTO v_prov
            FROM descuentos_cliente_proveedor d
            WHERE d.cliente_id = p_cliente
              AND d.proveedor_id = v_proveedor_producto
              AND d.borrado = FALSE;

            SELECT MAX(d.descuento_porcentaje) INTO v_cat
            FROM descuentos_cliente_categoria d
            WHERE d.cliente_id = p_cliente
              AND d.proveedor_id = v_proveedor_producto
              AND d.borrado = FALSE
              AND d.categoria_id IN (
                  SELECT pc.categoria_id
                  FROM producto_categoria pc
                  WHERE pc.producto_id = p_producto AND pc.borrado = FALSE
              );
        END IF;

        SELECT COALESCE(MAX(descuento_porcentaje), 0) INTO v_promo
        FROM v_promociones_tienda_vigentes;

        -- Precedencia por PRECISIÓN (el % no importa para elegir nivel).
        IF v_esp IS NOT NULL THEN
            v_disc := v_esp;
            v_origen := 'cliente_producto';
        ELSIF v_cat IS NOT NULL THEN
            v_disc := v_cat;
            v_origen := 'cliente_categoria';
        ELSIF v_prov IS NOT NULL THEN
            v_disc := v_prov;
            v_origen := 'cliente_proveedor';
        ELSIF v_gen > 0 THEN
            v_disc := v_gen;
            v_origen := 'cliente_general';
        END IF;

        -- Último recurso: la promo de tienda gana SOLO si su % es mayor.
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
-- 3. fn_descuentos_cuenta: misma firma/columnas + listas de categorías y
--    proveedores (las de combustible se conservan por compatibilidad).
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
        'categorias', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'proveedor_id', d.proveedor_id,
                    'categoria_id', d.categoria_id,
                    'pct', d.descuento_porcentaje
                )
                ORDER BY d.proveedor_id, d.categoria_id
            ), '[]'::jsonb)
            FROM descuentos_cliente_categoria d
            WHERE d.cliente_id = v_cliente AND d.borrado = FALSE
        ),
        'proveedores', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object('proveedor_id', d.proveedor_id, 'pct', d.descuento_porcentaje)
                ORDER BY d.proveedor_id
            ), '[]'::jsonb)
            FROM descuentos_cliente_proveedor d
            WHERE d.cliente_id = v_cliente AND d.borrado = FALSE
        ),
        'promo_pct', to_jsonb(v_promo),
        'proveedores_habilitados', v_proveedores
    );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_descuentos_cuenta(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_descuentos_cuenta(UUID) TO anon;
