-- ============================================================================
-- 0021: Comercial por defecto — asignación automática (ARQUITECTURA_ROLES §2)
--
-- * fn_comercial_defecto(): id del comercial con es_catalogo_general = TRUE.
-- * fn_asignar_comercial_defecto(): para el usuario actual — si es cliente
--   sin comercial, se le asigna el defecto y se devuelve; si ya tiene
--   comercial, se devuelve el suyo; si no es cliente, NULL.
-- * Trigger AFTER INSERT en usuarios: las altas nuevas de clientes sin
--   comercial reciben el defecto automáticamente.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_comercial_defecto()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id
    FROM usuarios u
    WHERE u.es_catalogo_general = TRUE
      AND u.rol = 'comercial'
      AND u.borrado = FALSE
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION fn_comercial_defecto() TO authenticated;

CREATE OR REPLACE FUNCTION fn_asignar_comercial_defecto()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid       UUID := auth.uid();
    v_rol       rol_usuario;
    v_comercial UUID;
BEGIN
    IF v_uid IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT u.rol, u.id_comercial INTO v_rol, v_comercial
    FROM usuarios u
    WHERE u.id = v_uid AND u.borrado = FALSE;

    IF v_rol IS DISTINCT FROM 'cliente' THEN
        RETURN NULL;
    END IF;

    IF v_comercial IS NOT NULL THEN
        RETURN v_comercial; -- ya tiene comercial: el suyo
    END IF;

    v_comercial := fn_comercial_defecto();
    IF v_comercial IS NOT NULL THEN
        UPDATE usuarios SET id_comercial = v_comercial
        WHERE id = v_uid AND id_comercial IS NULL;
    END IF;

    RETURN v_comercial;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_asignar_comercial_defecto() TO authenticated;

-- Alta de clientes: asignación automática del comercial por defecto.
-- (SECURITY DEFINER: el UPDATE de id_comercial lo hace el owner y no choca
-- con el trigger de protección de campos.)
CREATE OR REPLACE FUNCTION fn_usuarios_asignar_comercial_defecto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.rol = 'cliente' AND NEW.id_comercial IS NULL THEN
        UPDATE usuarios
        SET id_comercial = fn_comercial_defecto()
        WHERE id = NEW.id AND id_comercial IS NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_usuarios_asignar_comercial_defecto ON usuarios;
CREATE TRIGGER trg_usuarios_asignar_comercial_defecto
AFTER INSERT ON usuarios
FOR EACH ROW EXECUTE FUNCTION fn_usuarios_asignar_comercial_defecto();
