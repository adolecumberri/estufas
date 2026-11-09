-- ============================================================================
-- Test 13: historial de pedidos con atribución del actor (0028)
-- Decisión 10/11/2026: el admin opera pedidos y CADA cambio queda registrado
-- con quién lo hizo (nombre + rol) y es visible para el cliente, su comercial
-- y el admin.
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

SET LOCAL ROLE authenticated;

-- Pedido creado por el cliente particular 3333 (comercial responsable: 2222,
-- que tiene el proveedor Eider del producto habilitado).
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
CREATE TEMP TABLE tmp_pedido AS
SELECT * FROM crear_pedido(
    NULL,
    '[{"producto_id":"f1000000-0000-4000-8000-000000000003","cantidad":1}]'::jsonb,
    NULL
);

-- 1. El registro "Creado" queda atribuido al cliente (nombre y rol reales).
SELECT results_eq(
    $q$ SELECT actor_nombre::text, actor_rol::text
         FROM fn_pedido_historial((SELECT pedido_id FROM tmp_pedido))
        WHERE estado_anterior IS NULL $q$,
    $q$ SELECT u.nombre::text, u.rol::text
         FROM usuarios u WHERE u.id = '33333333-3333-4333-8333-333333333333' $q$,
    'el registro de creación queda atribuido al cliente'
);

-- 2. La confirmación del comercial responsable queda atribuida a él.
SELECT tests.authenticate_as('22222222-2222-4222-8222-222222222222');
SELECT lives_ok(
    $q$ SELECT confirmar_pedido((SELECT pedido_id FROM tmp_pedido), 'ok') $q$,
    'el comercial confirma el pedido'
);
SELECT results_eq(
    $q$ SELECT actor_nombre::text, actor_rol::text
         FROM fn_pedido_historial((SELECT pedido_id FROM tmp_pedido))
        WHERE estado_nuevo = 'confirmado' $q$,
    $q$ SELECT u.nombre::text, u.rol::text
         FROM usuarios u WHERE u.id = '22222222-2222-4222-8222-222222222222' $q$,
    'la confirmación queda atribuida al comercial'
);

-- 3. El admin opera el pedido (decisión 10/11/2026) y su cambio queda
--    atribuido a él.
SELECT tests.authenticate_as('11111111-1111-4111-8111-111111111111');
SELECT lives_ok(
    $q$ SELECT avanzar_pedido((SELECT pedido_id FROM tmp_pedido), 'en_preparacion', 'Decisión 10/11') $q$,
    'el admin avanza el pedido'
);
SELECT results_eq(
    $q$ SELECT actor_nombre::text, actor_rol::text
         FROM fn_pedido_historial((SELECT pedido_id FROM tmp_pedido))
        WHERE estado_nuevo = 'en_preparacion' $q$,
    $q$ SELECT u.nombre::text, u.rol::text
         FROM usuarios u WHERE u.id = '11111111-1111-4111-8111-111111111111' $q$,
    'el cambio del admin queda atribuido al admin'
);

-- 4. Otro cliente no ve el historial de un pedido ajeno.
SELECT tests.authenticate_as('44444444-4444-4444-8444-444444444444');
SELECT ok(
    (SELECT count(*) = 0
       FROM fn_pedido_historial((SELECT pedido_id FROM tmp_pedido))),
    'un cliente ajeno no ve el historial'
);

-- 5. El cliente dueño ve su historial completo (3 cambios).
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT ok(
    (SELECT count(*) = 3
       FROM fn_pedido_historial((SELECT pedido_id FROM tmp_pedido))),
    'el cliente ve su historial completo'
);

-- 6. El admin completa el pedido y ese cambio también queda atribuido.
SELECT tests.authenticate_as('11111111-1111-4111-8111-111111111111');
SELECT lives_ok(
    $q$ SELECT avanzar_pedido((SELECT pedido_id FROM tmp_pedido), 'completado', 'Completado por admin') $q$,
    'el admin completa el pedido'
);
SELECT results_eq(
    $q$ SELECT actor_nombre::text, actor_rol::text
         FROM fn_pedido_historial((SELECT pedido_id FROM tmp_pedido))
        WHERE estado_nuevo = 'completado' $q$,
    $q$ SELECT u.nombre::text, u.rol::text
         FROM usuarios u WHERE u.id = '11111111-1111-4111-8111-111111111111' $q$,
    'la completación del admin queda atribuida al admin'
);

SELECT * FROM finish();
ROLLBACK;
