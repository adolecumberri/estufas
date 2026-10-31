-- ============================================================================
-- 0022: fn_proveedores_visibles — anónimo ve el catálogo general
--    (ARQUITECTURA_ROLES §2/§3.1)
--
-- Reescribe la función de 0019 (misma firma id/nombre/icono/color) con la
-- regla nueva: el ANÓNIMO ve los proveedores del comercial POR DEFECTO
-- (habilitados y activos), no todos. El cliente sin comercial también ve los
-- del defecto. El resto de ramas se mantiene.
-- ============================================================================

DROP FUNCTION IF EXISTS fn_proveedores_visibles();

CREATE OR REPLACE FUNCTION fn_proveedores_visibles()
RETURNS TABLE (id UUID, nombre VARCHAR, icono VARCHAR, color VARCHAR)
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
        -- Anónimo: el Catálogo General = proveedores del comercial por
        -- defecto (habilitados y activos).
        v_comercial := fn_comercial_defecto();
        IF v_comercial IS NULL THEN
            RETURN;
        END IF;
        RETURN QUERY
        SELECT p.id, p.nombre, p.icono, p.color
        FROM proveedores p
        JOIN comercial_proveedor cp ON cp.proveedor_id = p.id
        WHERE cp.comercial_id = v_comercial
          AND cp.habilitado
          AND p.activo = TRUE
          AND p.borrado = FALSE
        ORDER BY p.nombre;
        RETURN;
    END IF;

    SELECT u.rol INTO v_rol
    FROM usuarios u
    WHERE u.id = v_uid AND u.borrado = FALSE AND u.activo = TRUE;

    IF v_rol IS NULL THEN
        RETURN; -- sin perfil activo: nada
    END IF;

    IF v_rol = 'admin' THEN
        RETURN QUERY
        SELECT p.id, p.nombre, p.icono, p.color
        FROM proveedores p
        WHERE p.activo = TRUE AND p.borrado = FALSE
        ORDER BY p.nombre;
        RETURN;
    END IF;

    IF v_rol = 'comercial' THEN
        v_comercial := v_uid;
    ELSIF v_rol = 'cliente' THEN
        SELECT u.id_comercial INTO v_comercial FROM usuarios u WHERE u.id = v_uid;
        IF v_comercial IS NULL THEN
            v_comercial := fn_comercial_defecto(); -- cliente sin comercial: defecto
        END IF;
    ELSE
        RETURN;
    END IF;

    IF v_comercial IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT p.id, p.nombre, p.icono, p.color
    FROM proveedores p
    JOIN comercial_proveedor cp ON cp.proveedor_id = p.id
    WHERE cp.comercial_id = v_comercial
      AND cp.habilitado
      AND p.activo = TRUE
      AND p.borrado = FALSE
    ORDER BY p.nombre;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_proveedores_visibles() TO anon, authenticated;
