-- ============================================================================
-- 0019: fn_proveedores_visibles con icono/color y selector anónimo
--
-- Amplía fn_proveedores_visibles (0011) con las columnas icono y color
-- (0017/0018) y cambia el comportamiento anónimo: ahora devuelve TODOS los
-- proveedores activos y no borrados (el selector del catálogo anónimo los
-- necesita). El resto de reglas por rol se mantienen.
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
        -- Anónimo: el selector del catálogo necesita la lista completa
        -- (sin datos sensibles: solo id/nombre/icono/color).
        RETURN QUERY
        SELECT p.id, p.nombre, p.icono, p.color
        FROM proveedores p
        WHERE p.activo = TRUE AND p.borrado = FALSE
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
    ELSE
        RETURN;
    END IF;

    IF v_comercial IS NULL THEN
        RETURN; -- cliente sin comercial asignado: nada
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
