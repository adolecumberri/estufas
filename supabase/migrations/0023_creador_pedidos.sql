-- ============================================================================
-- 0023: Actor real y comercial del cliente en pedidos (ARQUITECTURA_ROLES §3)
--
-- * crear_pedido: `creado_por` = auth.uid() SIEMPRE (actor real: cliente,
--   comercial o admin) y `comercial_id` = id_comercial del cliente con
--   fallback al comercial por defecto (fn_comercial_defecto). El resto de
--   validaciones (roles/alcance, proveedor único/habilitado, precios
--   congelados, FOR SHARE) se mantiene exactamente igual que en 0012.
-- * fn_pedido_detalle(p_pedido): RPC nuevo para que la app muestre QUIÉN
--   creó el pedido — devuelve todas las columnas de pedidos + creado_por
--   (ya incluido), creado_por_nombre y creado_por_rol, con el alcance:
--   cliente su pedido, comercial su cartera, admin todo.
--   (No existían RPCs de listado/detalle de pedidos: la app lee la tabla
--   con RLS; este RPC cubre la atribución de creador sin exponer datos.)
-- ============================================================================

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
        v_uid, -- actor real SIEMPRE: cliente, comercial o admin
        COALESCE(
            (SELECT id_comercial FROM usuarios WHERE id = v_cliente),
            fn_comercial_defecto()
        ), -- comercial del cliente (fallback: catálogo general)
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
-- Detalle de pedido con atribución del creador (para "Creado por: ...").
-- Alcance: cliente su pedido; comercial su cartera; admin todo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_pedido_detalle(p_pedido UUID)
RETURNS TABLE (
    id                UUID,
    numero_pedido     BIGINT,
    cliente_id        UUID,
    creado_por        UUID,
    creado_por_nombre VARCHAR,
    creado_por_rol    rol_usuario,
    comercial_id      UUID,
    estado            estado_pedido,
    fecha_pedido      TIMESTAMPTZ,
    observaciones     TEXT,
    moneda            CHAR(3),
    proveedor_id      UUID,
    borrado           BOOLEAN,
    created_at        TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ,
    deleted_at        TIMESTAMPTZ,
    deleted_by        UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT pe.id,
           pe.numero_pedido,
           pe.cliente_id,
           pe.creado_por,
           u.nombre,
           u.rol,
           pe.comercial_id,
           pe.estado,
           pe.fecha_pedido,
           pe.observaciones,
           pe.moneda,
           pe.proveedor_id,
           pe.borrado,
           pe.created_at,
           pe.updated_at,
           pe.deleted_at,
           pe.deleted_by
    FROM pedidos pe
    LEFT JOIN usuarios u ON u.id = pe.creado_por
    WHERE pe.id = p_pedido
      AND pe.borrado = FALSE
      AND (fn_es_admin()
           OR pe.cliente_id = auth.uid()
           OR fn_comercial_responsable(pe.cliente_id));
$$;

GRANT EXECUTE ON FUNCTION fn_pedido_detalle(UUID) TO authenticated;
