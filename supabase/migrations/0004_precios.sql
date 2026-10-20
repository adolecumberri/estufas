-- ============================================================================
-- 0004: Precios — actualización transaccional (admin).
--
-- Cierra el periodo vigente y abre uno nuevo en la misma transacción.
-- Si el precio vigente se creó hoy, se actualiza en su lugar (la granularidad
-- del histórico de precios es diaria, coherente con el EXCLUDE del esquema).
-- ============================================================================

CREATE OR REPLACE FUNCTION actualizar_precio(p_producto UUID, p_precio NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT fn_es_admin() THEN
        RAISE EXCEPTION 'Solo un administrador puede actualizar precios';
    END IF;
    IF p_precio IS NULL OR p_precio < 0 THEN
        RAISE EXCEPTION 'Precio inválido';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM productos WHERE id = p_producto AND borrado = FALSE) THEN
        RAISE EXCEPTION 'Producto no encontrado';
    END IF;

    IF EXISTS (
        SELECT 1 FROM producto_precios
        WHERE producto_id = p_producto
          AND borrado = FALSE
          AND fecha_inicio = fn_hoy()
          AND (fecha_fin IS NULL OR fecha_fin > fn_hoy())
    ) THEN
        -- Mismo día: se corrige el precio vigente (sin crear duplicado).
        UPDATE producto_precios
        SET precio = round(p_precio, 2)
        WHERE producto_id = p_producto
          AND borrado = FALSE
          AND fecha_inicio = fn_hoy()
          AND (fecha_fin IS NULL OR fecha_fin > fn_hoy());
    ELSE
        -- Cerrar el periodo vigente (fecha_fin exclusiva) y abrir uno nuevo.
        UPDATE producto_precios
        SET fecha_fin = fn_hoy()
        WHERE producto_id = p_producto
          AND borrado = FALSE
          AND (fecha_fin IS NULL OR fecha_fin > fn_hoy());

        INSERT INTO producto_precios (producto_id, precio, fecha_inicio, creado_por)
        VALUES (p_producto, round(p_precio, 2), fn_hoy(), auth.uid());
    END IF;
END;
$$;
