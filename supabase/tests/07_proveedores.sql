-- ============================================================================
-- Test 07: multi-empresa — proveedores, visibilidad y pedidos sin mezcla
-- ============================================================================
BEGIN;
SELECT plan(9);

CREATE SCHEMA IF NOT EXISTS tests;

CREATE OR REPLACE FUNCTION tests.authenticate_as(p_sub UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub::text)::text, TRUE);
END;
$$;

GRANT USAGE ON SCHEMA tests TO anon, authenticated;
GRANT EXECUTE ON FUNCTION tests.authenticate_as(UUID) TO anon, authenticated;

-- 1. No se pueden mezclar proveedores en un pedido (LP-9 prov 1 + LL-7 prov 2).
SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT throws_ok(
    $q$ SELECT * FROM crear_pedido(NULL,
        '[{"producto_id":"f1000000-0000-4000-8000-000000000001","cantidad":1},
          {"producto_id":"f1000000-0000-4000-8000-000000000003","cantidad":1}]'::jsonb, NULL) $q$,
    'No se pueden mezclar proveedores en un pedido',
    'no se mezclan proveedores en un pedido'
);

-- 2. El proveedor 3 no está habilitado para el comercial del cliente (LA-5).
SELECT throws_ok(
    $q$ SELECT * FROM crear_pedido(NULL,
        '[{"producto_id":"f1000000-0000-4000-8000-000000000006","cantidad":1}]'::jsonb, NULL) $q$,
    'El proveedor no está habilitado para este comercial',
    'el proveedor no habilitado bloquea el pedido'
);

-- 3. El catálogo del cliente particular oculta el proveedor 3 (LA-5) y
--    muestra los habilitados 1 y 2.
SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2(NULL, NULL, NULL, NULL, 200, 0, NULL)
        ORDER BY referencia $q$,
    ARRAY['EF-8', 'LL-7', 'LP-9', 'TF-12', 'TF-70'],
    'el cliente ve solo los proveedores habilitados de su comercial'
);

-- 4. El admin asigna el proveedor 3 al comercial y LA-5 aparece.
SELECT tests.authenticate_as('11111111-1111-4111-8111-111111111111');
SELECT asignar_proveedor_comercial(
    '22222222-2222-4222-8222-222222222222',
    '91000000-0000-4000-8000-000000000003'
);
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2(NULL, NULL, NULL, NULL, 200, 0, NULL)
        ORDER BY referencia $q$,
    ARRAY['EF-8', 'LA-5', 'LL-7', 'LP-9', 'TF-12', 'TF-70'],
    'tras habilitar el proveedor 3, el cliente ve LA-5'
);

-- 5. El pedido congela el proveedor de sus líneas (TF-12 → proveedor 1).
CREATE TEMP TABLE tmp_pedido AS
SELECT * FROM crear_pedido(NULL,
    '[{"producto_id":"f1000000-0000-4000-8000-000000000002","cantidad":1}]'::jsonb, NULL);

SELECT results_eq(
    $q$ SELECT proveedor_id::text FROM pedidos
        WHERE id = (SELECT pedido_id FROM tmp_pedido) $q$,
    ARRAY['91000000-0000-4000-8000-000000000001'],
    'el pedido guarda el proveedor de sus líneas'
);

-- 6. Un proveedor inactivo oculta sus productos (actualizar_proveedor).
SELECT tests.authenticate_as('11111111-1111-4111-8111-111111111111');
SELECT actualizar_proveedor(
    '91000000-0000-4000-8000-000000000002',
    NULL, NULL, NULL, NULL, FALSE
);
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2(NULL, NULL, NULL, NULL, 200, 0, NULL)
        ORDER BY referencia $q$,
    ARRAY['LA-5', 'LP-9', 'TF-12', 'TF-70'],
    'un proveedor inactivo oculta sus productos'
);

-- 7. El proveedor de un pedido queda congelado al editarlo (p1 → p3).
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT throws_ok(
    $q$ SELECT editar_pedido((SELECT pedido_id FROM tmp_pedido),
        '[{"producto_id":"f1000000-0000-4000-8000-000000000006","cantidad":1}]'::jsonb) $q$,
    'No se puede cambiar el proveedor del pedido',
    'no se cambia el proveedor congelado del pedido'
);

-- 8. Un cliente sin comercial no ve productos con proveedor ni puede pedirlos.
RESET ROLE;
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
('00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555',
 'authenticated', 'authenticated', 'suelto@estufas.local',
 crypt('Suelto123!', gen_salt('bf')), now(), now(), now(),
 '{"provider":"email","providers":["email"]}',
 '{"rol":"cliente","tipo_cliente":"particular","nombre":"Cliente","apellidos":"Suelto"}', '', '', '', '');

SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('55555555-5555-4555-8555-555555555555');
SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2(NULL, NULL, NULL, NULL, 200, 0, NULL)
        ORDER BY referencia $q$,
    ARRAY[]::text[],
    'un cliente sin comercial no ve productos con proveedor asignado'
);
SELECT throws_ok(
    $q$ SELECT * FROM crear_pedido(NULL,
        '[{"producto_id":"f1000000-0000-4000-8000-000000000002","cantidad":1}]'::jsonb, NULL) $q$,
    'El cliente no tiene comercial asignado',
    'un cliente sin comercial no puede pedir productos con proveedor'
);

SELECT * FROM finish();
ROLLBACK;
