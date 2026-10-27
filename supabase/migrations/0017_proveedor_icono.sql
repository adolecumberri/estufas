-- ============================================================================
-- 0017: Icono de proveedor
--
-- `proveedores.icono`: nombre del icono lucide que usa la UI para el
-- proveedor ('flame', 'flower', ...). NULL = sin icono.
-- ============================================================================

ALTER TABLE proveedores
    ADD COLUMN IF NOT EXISTS icono VARCHAR(20) DEFAULT NULL;

-- Idempotente: solo toca los dos proveedores vigentes.
UPDATE proveedores SET icono = 'flame'
WHERE id = '91000000-0000-4000-8000-000000000004'; -- Eider Biomasa

UPDATE proveedores SET icono = 'flower'
WHERE id = '91000000-0000-4000-8000-000000000005'; -- Fansa
