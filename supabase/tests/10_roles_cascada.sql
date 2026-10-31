-- ============================================================================
-- Test 10: roles en cascada — catálogo general, asignación automática y
--          atribución del creador en pedidos (0020-0023)
-- ============================================================================
BEGIN;
SELECT plan(12);

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

-- 1. El catálogo general es único.
SELECT results_eq(
    $q$ SELECT count(*)::int FROM usuarios WHERE es_catalogo_general = TRUE $q$,
    ARRAY[1],
    'existe exactamente un comercial de catálogo general'
);

-- 2. fn_comercial_defecto() devuelve el comercial 2222.
SELECT results_eq(
    $q$ SELECT fn_comercial_defecto()::text $q$,
    ARRAY['22222222-2222-4222-8222-222222222222'],
    'el comercial por defecto es el 2222'
);

-- 3. El alta de un cliente nuevo recibe el comercial por defecto.
RESET ROLE;
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
('00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555',
 'authenticated', 'authenticated', 'nuevo@estufas.local',
 crypt('Nuevo123!', gen_salt('bf')), now(), now(), now(),
 '{"provider":"email","providers":["email"]}',
 '{"rol":"cliente","tipo_cliente":"particular","nombre":"Cliente","apellidos":"Nuevo"}', '', '', '', '');

SELECT results_eq(
    $q$ SELECT id_comercial::text FROM usuarios WHERE id = '55555555-5555-4555-8555-555555555555' $q$,
    ARRAY['22222222-2222-4222-8222-222222222222'],
    'el cliente nuevo recibe el comercial por defecto'
);

-- 4. Un cliente EXISTENTE sin comercial se asigna con la RPC.
UPDATE usuarios SET id_comercial = NULL WHERE id = '55555555-5555-4555-8555-555555555555';
SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('55555555-5555-4555-8555-555555555555');
SELECT results_eq(
    $q$ SELECT fn_asignar_comercial_defecto()::text $q$,
    ARRAY['22222222-2222-4222-8222-222222222222'],
    'la RPC asigna el comercial por defecto al cliente existente'
);
SELECT results_eq(
    $q$ SELECT id_comercial::text FROM usuarios WHERE id = '55555555-5555-4555-8555-555555555555' $q$,
    ARRAY['22222222-2222-4222-8222-222222222222'],
    'la RPC deja el id_comercial persistido'
);

-- 5. Anónimo: fn_proveedores_visibles = proveedores del comercial por defecto
--    (2222 tiene Eider y Fansa por el seed/0020).
SET LOCAL ROLE anon;
SELECT results_eq(
    $q$ SELECT id::text FROM fn_proveedores_visibles() ORDER BY id $q$,
    ARRAY['91000000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000005'],
    'el anónimo ve los proveedores del comercial por defecto'
);

-- 6. Un cliente no ve los proveedores de otro comercial (suelto → 6666, solo Fansa).
RESET ROLE;
UPDATE usuarios SET id_comercial = '66666666-6666-4666-8666-666666666666'
WHERE id = '88888888-8888-4888-8888-888888888888';
SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('88888888-8888-4888-8888-888888888888');
SELECT results_eq(
    $q$ SELECT id::text FROM fn_proveedores_visibles() ORDER BY id $q$,
    ARRAY['91000000-0000-4000-8000-000000000005'],
    'el cliente ve solo los proveedores de su comercial'
);

-- 7. El comercial crea el pedido para su cliente: creado_por = comercial,
--    comercial_id = su comercial (el del cliente).
SELECT tests.authenticate_as('22222222-2222-4222-8222-222222222222');
CREATE TEMP TABLE tmp_p1 AS
SELECT * FROM crear_pedido('33333333-3333-4333-8333-333333333333',
    '[{"producto_id":"f1000000-0000-4000-8000-000000000002","cantidad":1}]'::jsonb, NULL);
SELECT results_eq(
    $q$ SELECT creado_por::text || '|' || comercial_id::text FROM pedidos
        WHERE id = (SELECT pedido_id FROM tmp_p1) $q$,
    ARRAY['22222222-2222-4222-8222-222222222222|22222222-2222-4222-8222-222222222222'],
    'el pedido del comercial guarda actor y comercial correctos'
);

-- 8. El admin crea el pedido para un cliente: creado_por = admin,
--    comercial_id = el comercial del cliente.
SELECT tests.authenticate_as('11111111-1111-4111-8111-111111111111');
CREATE TEMP TABLE tmp_p2 AS
SELECT * FROM crear_pedido('33333333-3333-4333-8333-333333333333',
    '[{"producto_id":"f1000000-0000-4000-8000-000000000001","cantidad":1}]'::jsonb, NULL);
SELECT results_eq(
    $q$ SELECT creado_por::text || '|' || comercial_id::text FROM pedidos
        WHERE id = (SELECT pedido_id FROM tmp_p2) $q$,
    ARRAY['11111111-1111-4111-8111-111111111111|22222222-2222-4222-8222-222222222222'],
    'el pedido del admin guarda actor y comercial del cliente'
);

-- 9. fn_pedido_detalle devuelve quién creó el pedido (rol del actor).
SELECT results_eq(
    $q$ SELECT creado_por_rol::text || ':' || creado_por_nombre
        FROM fn_pedido_detalle((SELECT pedido_id FROM tmp_p2)) $q$,
    ARRAY['admin:Administrador'],
    'el detalle atribuye el pedido al admin'
);

-- 10. Un cliente NO puede crear pedidos para otro cliente.
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT throws_ok(
    $q$ SELECT * FROM crear_pedido('44444444-4444-4444-8444-444444444444',
        '[{"producto_id":"f1000000-0000-4000-8000-000000000002","cantidad":1}]'::jsonb, NULL) $q$,
    'Solo puedes crear pedidos propios',
    'un cliente no crea pedidos para otro cliente'
);

-- 11. Un comercial NO puede crear pedidos para un cliente ajeno.
SELECT tests.authenticate_as('66666666-6666-4666-8666-666666666666');
SELECT throws_ok(
    $q$ SELECT * FROM crear_pedido('33333333-3333-4333-8333-333333333333',
        '[{"producto_id":"f1000000-0000-4000-8000-000000000002","cantidad":1}]'::jsonb, NULL) $q$,
    'El comercial solo puede crear pedidos para clientes asignados',
    'un comercial no crea pedidos para un cliente ajeno'
);

SELECT * FROM finish();
ROLLBACK;
