-- ============================================================================
-- 0014: Consolidación de proveedores + creación de comerciales (admin)
--
-- El catálogo se reduce a DOS proveedores: Eider Biomasa (004) y Fansa
-- (005). Los tres proveedores antiguos del seed (Estufas Norte 001, Calor
-- Hogar 002, EcoCalor Global 003) se eliminan: sus productos y pedidos pasan
-- a Eider y sus asignaciones se desasignan. Además se añade el RPC
-- crear_comercial para provisionar comerciales desde el panel de admin.
-- (Idempotente: re-ejecutable en BD viva.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Reasignar productos y pedidos de los proveedores antiguos a Eider.
-- ---------------------------------------------------------------------------
UPDATE productos
SET proveedor_id = '91000000-0000-4000-8000-000000000004'
WHERE proveedor_id IN (
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000003'
);

UPDATE pedidos
SET proveedor_id = '91000000-0000-4000-8000-000000000004'
WHERE proveedor_id IN (
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000003'
);

-- ---------------------------------------------------------------------------
-- 2. Desasignar los proveedores antiguos de los comerciales.
-- ---------------------------------------------------------------------------
DELETE FROM comercial_proveedor
WHERE proveedor_id IN (
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000003'
);

-- ---------------------------------------------------------------------------
-- 3. Eliminar los proveedores antiguos (guard: si quedan referencias en
--    productos/pedidos/comercial_proveedor, se aborta sin borrar).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_refs BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_refs
    FROM (
        SELECT 1 FROM productos
        WHERE proveedor_id IN (
            '91000000-0000-4000-8000-000000000001',
            '91000000-0000-4000-8000-000000000002',
            '91000000-0000-4000-8000-000000000003'
        )
        UNION ALL
        SELECT 1 FROM pedidos
        WHERE proveedor_id IN (
            '91000000-0000-4000-8000-000000000001',
            '91000000-0000-4000-8000-000000000002',
            '91000000-0000-4000-8000-000000000003'
        )
        UNION ALL
        SELECT 1 FROM comercial_proveedor
        WHERE proveedor_id IN (
            '91000000-0000-4000-8000-000000000001',
            '91000000-0000-4000-8000-000000000002',
            '91000000-0000-4000-8000-000000000003'
        )
    ) x;

    IF v_refs > 0 THEN
        RAISE EXCEPTION 'Quedan referencias a los proveedores antiguos; no se eliminan';
    END IF;

    DELETE FROM proveedores
    WHERE id IN (
        '91000000-0000-4000-8000-000000000001',
        '91000000-0000-4000-8000-000000000002',
        '91000000-0000-4000-8000-000000000003'
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. crear_comercial: provisiona un comercial desde el panel de admin.
--    El trigger de registro (0010) crea el perfil como cliente; este UPDATE
--    lo asciende a comercial (igual que el flujo de administración).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_comercial(
    p_email     VARCHAR,
    p_password  VARCHAR,
    p_nombre    VARCHAR,
    p_apellidos VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF NOT fn_es_admin() THEN
        RAISE EXCEPTION 'Solo un administrador puede crear comerciales';
    END IF;
    IF p_email IS NULL OR btrim(p_email) = '' THEN
        RAISE EXCEPTION 'El email es obligatorio';
    END IF;
    IF p_password IS NULL OR length(p_password) < 8 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres';
    END IF;
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RAISE EXCEPTION 'Ya existe un usuario con ese email';
    END IF;

    v_id := gen_random_uuid();

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_id,
        'authenticated',
        'authenticated',
        p_email,
        crypt(p_password, gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('rol', 'comercial', 'nombre', p_nombre, 'apellidos', p_apellidos),
        '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
        gen_random_uuid(),
        v_id,
        jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
        'email', p_email, now(), now(), now()
    );

    -- El trigger 0010 habrá creado el perfil como cliente; se asciende aquí.
    UPDATE usuarios
    SET rol = 'comercial',
        tipo_cliente = NULL,
        nombre = COALESCE(p_nombre, nombre),
        apellidos = COALESCE(p_apellidos, apellidos)
    WHERE id = v_id;

    INSERT INTO auditoria (tabla, registro_id, accion, realizado_por, datos_anteriores, datos_nuevos)
    VALUES ('usuarios', v_id, 'crear_comercial', auth.uid(), NULL,
            (SELECT to_jsonb(u) FROM usuarios u WHERE u.id = v_id));

    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION crear_comercial(VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
