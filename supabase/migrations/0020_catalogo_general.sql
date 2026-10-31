-- ============================================================================
-- 0020: Catálogo General — comercial por defecto (ARQUITECTURA_ROLES §2)
--
-- * usuarios.es_catalogo_general: flag del comercial especial cuyo catálogo
--   ve el anónimo. Único (índice parcial) y solo para rol 'comercial'.
-- * El flag lo gestiona SOLO el backend (postgres/service_role): se amplía
--   el trigger de protección de campos para que ni el admin de UI ni el
--   propio comercial puedan cambiarlo.
-- * Marca el comercial de desarrollo (comercial@estufas.local) y le habilita
--   TODOS los proveedores activos (idempotente; en BD viva).
-- ============================================================================

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS es_catalogo_general BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_usuarios_catalogo_general'
    ) THEN
        ALTER TABLE usuarios ADD CONSTRAINT chk_usuarios_catalogo_general
            CHECK (es_catalogo_general = FALSE OR rol = 'comercial');
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uix_usuarios_catalogo_general
    ON usuarios (es_catalogo_general) WHERE es_catalogo_general = TRUE;

-- ---------------------------------------------------------------------------
-- Protección del flag: solo postgres/service_role. El resto de columnas
-- protegidas mantiene el comportamiento de 0002 (admin puede).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_usuarios_proteger_campos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- El flag de catálogo general solo lo gestiona el backend (migración/seed).
    IF NEW.es_catalogo_general IS DISTINCT FROM OLD.es_catalogo_general
       AND current_user NOT IN ('postgres', 'service_role') THEN
        RAISE EXCEPTION 'El flag de catálogo general solo lo gestiona el backend';
    END IF;

    IF current_user IN ('postgres', 'service_role') OR fn_es_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.rol IS DISTINCT FROM OLD.rol
    OR NEW.id_comercial IS DISTINCT FROM OLD.id_comercial
    OR NEW.descuento_porcentaje IS DISTINCT FROM OLD.descuento_porcentaje
    OR NEW.activo IS DISTINCT FROM OLD.activo
    OR NEW.borrado IS DISTINCT FROM OLD.borrado
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by THEN
        RAISE EXCEPTION 'Solo un administrador puede modificar rol, asignación comercial, descuentos o estado del usuario';
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Marcar el comercial de desarrollo como catálogo general (solo si no hay
-- otro) y habilitarle todos los proveedores activos.
-- ---------------------------------------------------------------------------
UPDATE usuarios
SET es_catalogo_general = TRUE
WHERE email = 'comercial@estufas.local'
  AND rol = 'comercial'
  AND NOT EXISTS (SELECT 1 FROM usuarios WHERE es_catalogo_general = TRUE);

INSERT INTO comercial_proveedor (comercial_id, proveedor_id, habilitado, creado_por)
SELECT u.id, p.id, TRUE, NULL
FROM usuarios u
CROSS JOIN proveedores p
WHERE u.email = 'comercial@estufas.local'
  AND u.rol = 'comercial'
  AND p.activo = TRUE
  AND p.borrado = FALSE
ON CONFLICT (comercial_id, proveedor_id) DO UPDATE SET habilitado = TRUE;
