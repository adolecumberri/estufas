-- ============================================================================
-- 0018: Color de proveedor
--
-- `proveedores.color`: color HEX (#RRGGBB) del proveedor para la UI (temas
-- de tarjeta, chips, etc.). NULL = sin color (la UI usa el primario global).
-- ============================================================================

ALTER TABLE proveedores
    ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT NULL;

-- Idempotente: solo toca los dos proveedores vigentes.
UPDATE proveedores SET color = '#E1680F'
WHERE id = '91000000-0000-4000-8000-000000000004'; -- Eider Biomasa

UPDATE proveedores SET color = '#6FC2B9'
WHERE id = '91000000-0000-4000-8000-000000000005'; -- Fansa
