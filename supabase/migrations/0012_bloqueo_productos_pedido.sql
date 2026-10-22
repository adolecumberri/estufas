-- ============================================================================
-- 0012: Bloqueo de productos al crear/editar pedido (CodeRabbit, Moderate)
--
-- Carrera detectada: si un admin reasigna el proveedor de un producto
-- MIENTRAS se crea/edita un pedido, las validaciones de proveedor único/
-- habilitado pueden observar conjuntos distintos (COUNT vs SELECT) y congelar
-- un proveedor incorrecto. Solución: bloquear las filas de los productos del
-- pedido al inicio de la operación (FOR SHARE) para serializar con la
-- reasignación administrativa (bloqueo corto, solo durante la transacción).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. crear_pedido (0007) + bloqueo FOR SHARE de los productos de las líneas.
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

    -- Bloquea los productos de las líneas (FOR SHARE): serializa con la
    -- reasignación de proveedor del admin; bloqueo corto, solo durante la
    -- transacción del pedido. Con p_lineas vacío o NULL el IN queda vacío y
    -- el bloqueo es un no-op.
    PERFORM 1
    FROM productos
    WHERE id IN (SELECT (l->>'producto_id')::uuid FROM jsonb_array_elements(p_lineas) l)
    FOR SHARE;

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
-- 2. editar_pedido (0011) + el MISMO bloqueo FOR SHARE cuando llegan líneas.
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
        -- Bloquea los productos de las líneas (FOR SHARE): serializa con la
        -- reasignación de proveedor del admin; bloqueo corto, solo durante
        -- la transacción del pedido.
        PERFORM 1
        FROM productos
        WHERE id IN (SELECT (l->>'producto_id')::uuid FROM jsonb_array_elements(p_lineas) l)
        FOR SHARE;

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

        SELECT u.id_comercial INTO v_comercial FROM usuarios u WHERE u.id = v_pedido.cliente_id;
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
    -- cambiarlo (solo rellenarlo si el pedido aún no lo tenía). Solo aplica
    -- cuando llegan líneas nuevas.
    IF p_lineas IS NOT NULL
       AND v_pedido.proveedor_id IS NOT NULL
       AND v_proveedor IS DISTINCT FROM v_pedido.proveedor_id THEN
        RAISE EXCEPTION 'No se puede cambiar el proveedor del pedido';
    END IF;
    IF p_lineas IS NOT NULL
       AND v_pedido.proveedor_id IS NULL
       AND v_proveedor IS NOT NULL THEN
        UPDATE pedidos SET proveedor_id = v_proveedor WHERE id = p_pedido;
    END IF;

    PERFORM set_config('app.nota_estado', 'Pedido editado', true);

    UPDATE pedidos
    SET observaciones = COALESCE(p_observaciones, observaciones)
    WHERE id = p_pedido;

    -- Solo se sustituyen las líneas cuando llegan líneas nuevas: p_lineas
    -- NULL = actualización de observaciones sin tocar las líneas.
    IF p_lineas IS NOT NULL THEN
        DELETE FROM pedido_lineas WHERE pedido_id = p_pedido; -- auditado por trigger

        INSERT INTO pedido_lineas (
            pedido_id, producto_id, referencia_producto, nombre_producto, cantidad,
            precio_unitario, descuento_porcentaje, descuento_origen, descuento_importe,
            iva_porcentaje, base_imponible, cuota_iva, total_linea
        )
        SELECT p_pedido, l.* FROM fn_calcular_lineas(v_pedido.cliente_id, p_lineas) l;
    END IF;
END;
$$;
