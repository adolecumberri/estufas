-- ============================================================================
-- 0026: RPCs de escritura de descuentos con auditoría (alcance admin/comercial)
--
-- Alcance: cliente → PROHIBIDO; comercial → solo su cartera; admin →
-- cualquier cliente. Cada cambio queda en descuentos_historial (triggers de
-- 0024) con el actor real (fn_app_user_id()) y su rol; los RPC de producto
-- existentes (asignar/anular_descuento_cliente_producto) ya validan alcance y
-- ahora también registran historial vía trigger.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_upsert_descuento_general(p_cliente UUID, p_porcentaje NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente)) THEN
        RAISE EXCEPTION 'Sin permiso para modificar descuentos de este cliente';
    END IF;
    IF p_porcentaje IS NULL OR p_porcentaje < 0 OR p_porcentaje > 100 THEN
        RAISE EXCEPTION 'Descuento fuera de rango';
    END IF;

    UPDATE usuarios SET descuento_porcentaje = round(p_porcentaje, 2) WHERE id = p_cliente;
END;
$$;

CREATE OR REPLACE FUNCTION fn_upsert_descuento_proveedor(
    p_cliente UUID,
    p_proveedor UUID,
    p_porcentaje NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente)) THEN
        RAISE EXCEPTION 'Sin permiso para modificar descuentos de este cliente';
    END IF;
    IF p_porcentaje IS NULL OR p_porcentaje < 0 OR p_porcentaje > 100 THEN
        RAISE EXCEPTION 'Descuento fuera de rango';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM proveedores WHERE id = p_proveedor AND activo = TRUE AND borrado = FALSE
    ) THEN
        RAISE EXCEPTION 'El proveedor no existe o no está activo';
    END IF;

    INSERT INTO descuentos_cliente_proveedor (cliente_id, proveedor_id, descuento_porcentaje, creado_por)
    VALUES (p_cliente, p_proveedor, round(p_porcentaje, 2), auth.uid())
    ON CONFLICT (cliente_id, proveedor_id) WHERE borrado = FALSE
    DO UPDATE SET descuento_porcentaje = EXCLUDED.descuento_porcentaje,
                  actualizado_por = auth.uid(),
                  actualizado_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION fn_upsert_descuento_categoria(
    p_cliente UUID,
    p_proveedor UUID,
    p_categoria UUID,
    p_porcentaje NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente)) THEN
        RAISE EXCEPTION 'Sin permiso para modificar descuentos de este cliente';
    END IF;
    IF p_porcentaje IS NULL OR p_porcentaje < 0 OR p_porcentaje > 100 THEN
        RAISE EXCEPTION 'Descuento fuera de rango';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM categorias WHERE id = p_categoria AND borrado = FALSE) THEN
        RAISE EXCEPTION 'La categoría no existe';
    END IF;

    INSERT INTO descuentos_cliente_categoria (cliente_id, proveedor_id, categoria_id, descuento_porcentaje, creado_por)
    VALUES (p_cliente, p_proveedor, p_categoria, round(p_porcentaje, 2), auth.uid())
    ON CONFLICT (cliente_id, proveedor_id, categoria_id) WHERE borrado = FALSE
    DO UPDATE SET descuento_porcentaje = EXCLUDED.descuento_porcentaje,
                  actualizado_por = auth.uid(),
                  actualizado_at = now();
END;
$$;

-- Producto: reutiliza la lógica del RPC existente de 0003 (INSERT + auditoria);
-- el trigger de historial de 0024 registra el cambio con el actor real.
CREATE OR REPLACE FUNCTION fn_upsert_descuento_producto(
    p_cliente UUID,
    p_producto UUID,
    p_porcentaje NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row UUID;
BEGIN
    IF NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente)) THEN
        RAISE EXCEPTION 'Sin permiso para modificar descuentos de este cliente';
    END IF;
    IF p_porcentaje IS NULL OR p_porcentaje < 0 OR p_porcentaje > 100 THEN
        RAISE EXCEPTION 'Descuento fuera de rango';
    END IF;

    INSERT INTO descuentos_cliente_producto (cliente_id, producto_id, descuento_porcentaje, creado_por)
    VALUES (p_cliente, p_producto, round(p_porcentaje, 2), auth.uid())
    RETURNING id INTO v_row;

    INSERT INTO auditoria (tabla, registro_id, accion, realizado_por, datos_anteriores, datos_nuevos)
    VALUES ('descuentos_cliente_producto', v_row, 'INSERT', auth.uid(), NULL,
            (SELECT to_jsonb(d) FROM descuentos_cliente_producto d WHERE id = v_row));
END;
$$;

CREATE OR REPLACE FUNCTION fn_anular_descuento_general(p_cliente UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente)) THEN
        RAISE EXCEPTION 'Sin permiso para modificar descuentos de este cliente';
    END IF;

    UPDATE usuarios SET descuento_porcentaje = 0 WHERE id = p_cliente;
END;
$$;

CREATE OR REPLACE FUNCTION fn_anular_descuento_proveedor(p_cliente UUID, p_proveedor UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente)) THEN
        RAISE EXCEPTION 'Sin permiso para modificar descuentos de este cliente';
    END IF;

    UPDATE descuentos_cliente_proveedor
    SET borrado = TRUE, deleted_at = now(), actualizado_por = auth.uid(), actualizado_at = now()
    WHERE cliente_id = p_cliente AND proveedor_id = p_proveedor AND borrado = FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION fn_anular_descuento_categoria(p_cliente UUID, p_proveedor UUID, p_categoria UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente)) THEN
        RAISE EXCEPTION 'Sin permiso para modificar descuentos de este cliente';
    END IF;

    UPDATE descuentos_cliente_categoria
    SET borrado = TRUE, deleted_at = now(), actualizado_por = auth.uid(), actualizado_at = now()
    WHERE cliente_id = p_cliente AND proveedor_id = p_proveedor AND categoria_id = p_categoria
      AND borrado = FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_upsert_descuento_general(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_upsert_descuento_proveedor(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_upsert_descuento_categoria(UUID, UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_upsert_descuento_producto(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_anular_descuento_general(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_anular_descuento_proveedor(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_anular_descuento_categoria(UUID, UUID, UUID) TO authenticated;
