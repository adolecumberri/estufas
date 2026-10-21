-- ============================================================================
-- 0011: Endurecimiento de seguridad de proveedores (CodeRabbit, Moderate)
--
-- 1) La tabla proveedores queda legible SOLO para admin: hoy cualquier
--    autenticado veía NIF/email/teléfono de todos los proveedores. Los
--    nombres llegan a comercial/cliente vía fn_proveedores_visibles y los
--    RPCs del catálogo (SECURITY DEFINER), no vía la tabla.
-- 2) fn_proveedores_visibles(): id+nombre según rol — admin: todos activos;
--    comercial: sus habilitados; cliente: los habilitados de su comercial;
--    anónimo: nada.
-- 3) editar_pedido: con p_lineas NULL solo se actualizan las observaciones
--    y se conservan las líneas (antes el DELETE las borraba).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Lectura de proveedores: solo admin.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS pol_proveedores_select ON proveedores;
CREATE POLICY pol_proveedores_select ON proveedores
    FOR SELECT
    USING (fn_es_admin());

-- ---------------------------------------------------------------------------
-- 2. Proveedores visibles por rol (id + nombre, sin datos sensibles).
--    (Columnas cualificadas con alias: los OUT id/nombre de RETURNS TABLE
--    sombrearían las columnas de tabla en referencias sin cualificar.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_proveedores_visibles()
RETURNS TABLE (id UUID, nombre VARCHAR)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid       UUID := auth.uid();
    v_rol       rol_usuario;
    v_comercial UUID;
BEGIN
    IF v_uid IS NULL THEN
        RETURN; -- anónimo: nada
    END IF;

    SELECT u.rol INTO v_rol
    FROM usuarios u
    WHERE u.id = v_uid AND u.borrado = FALSE AND u.activo = TRUE;

    IF v_rol IS NULL THEN
        RETURN; -- sin perfil activo: nada
    END IF;

    IF v_rol = 'admin' THEN
        RETURN QUERY
        SELECT p.id, p.nombre
        FROM proveedores p
        WHERE p.activo = TRUE AND p.borrado = FALSE
        ORDER BY p.nombre;
        RETURN;
    END IF;

    IF v_rol = 'comercial' THEN
        v_comercial := v_uid;
    ELSIF v_rol = 'cliente' THEN
        SELECT u.id_comercial INTO v_comercial FROM usuarios u WHERE u.id = v_uid;
    ELSE
        RETURN;
    END IF;

    IF v_comercial IS NULL THEN
        RETURN; -- cliente sin comercial asignado: nada
    END IF;

    RETURN QUERY
    SELECT p.id, p.nombre
    FROM proveedores p
    JOIN comercial_proveedor cp ON cp.proveedor_id = p.id
    WHERE cp.comercial_id = v_comercial
      AND cp.habilitado
      AND p.activo = TRUE
      AND p.borrado = FALSE
    ORDER BY p.nombre;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_proveedores_visibles() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. editar_pedido: conserva las líneas cuando p_lineas es NULL.
--    Copia de la versión de 0007 (validación de proveedor único/habilitado y
--    congelación del proveedor) con dos ajustes: el DELETE+INSERT de líneas
--    pasa a estar dentro de IF p_lineas IS NOT NULL, y la congelación solo se
--    evalúa cuando llegan líneas nuevas (si no, un UPDATE de solo
--    observaciones en un pedido con proveedor congelado fallaría al comparar
--    v_proveedor NULL con el proveedor guardado).
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
