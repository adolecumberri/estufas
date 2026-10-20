-- ============================================================================
-- Test 04: estados y permisos de gestión de pedidos
-- ============================================================================
BEGIN;
SELECT plan(6);

CREATE OR REPLACE FUNCTION tests.authenticate_as(p_sub UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub::text)::text, TRUE);
END;
$$;

SET LOCAL ROLE authenticated;

-- Pedido del cliente particular (comercial responsable: 2222...).
PERFORM tests.authenticate_as('33333333-3333-4333-8333-333333333333');
CREATE TEMP TABLE tmp_pedido AS
SELECT * FROM crear_pedido(NULL, '[{"producto_id":"f1000000-0000-4000-8000-000000000003","cantidad":1}]'::jsonb, NULL);

-- 1. El cliente NO puede confirmar su propio pedido.
SELECT throws_ok(
    $q$ SELECT confirmar_pedido((SELECT pedido_id FROM tmp_pedido)) $q$,
    'Solo el comercial responsable o un administrador pueden confirmar',
    'el cliente no confirma pedidos'
);

-- 2. El cliente SÍ puede cancelar su solicitud pendiente.
SELECT lives_ok(
    $q$ SELECT cancelar_pedido((SELECT pedido_id FROM tmp_pedido), 'me arrepiento') $q$,
    'el cliente cancela una solicitud pendiente'
);

-- Pedido nuevo para probar confirmación y ajustes.
CREATE TEMP TABLE tmp_pedido2 AS
SELECT * FROM crear_pedido(NULL, '[{"producto_id":"f1000000-0000-4000-8000-000000000003","cantidad":2}]'::jsonb, NULL);

-- 3. El comercial responsable confirma.
PERFORM tests.authenticate_as('22222222-2222-4222-8222-222222222222');
SELECT lives_ok(
    $q$ SELECT confirmar_pedido((SELECT pedido_id FROM tmp_pedido2), 'ok') $q$,
    'el comercial responsable confirma el pedido'
);

-- 4. Tras confirmar, no se puede editar.
SELECT throws_ok(
    $q$ SELECT editar_pedido((SELECT pedido_id FROM tmp_pedido2),
        '[{"producto_id":"f1000000-0000-4000-8000-000000000004","cantidad":1}]'::jsonb) $q$,
    'Solo se pueden editar pedidos solicitados',
    'no se edita un pedido confirmado'
);

-- 5. Tras confirmar, no se pueden ajustar descuentos de línea.
SELECT throws_ok(
    $q$ SELECT ajustar_descuento_linea(
        (SELECT id FROM pedido_lineas WHERE pedido_id = (SELECT pedido_id FROM tmp_pedido2) LIMIT 1),
        15.00) $q$,
    'Solo se pueden ajustar descuentos mientras el pedido está solicitado',
    'no se ajustan descuentos en pedidos confirmados'
);

-- 6. El cliente NO puede cancelar un pedido ya confirmado.
PERFORM tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT throws_ok(
    $q$ SELECT cancelar_pedido((SELECT pedido_id FROM tmp_pedido2)) $q$,
    'El cliente solo puede cancelar solicitudes pendientes',
    'el cliente no cancela pedidos confirmados'
);

SELECT * FROM finish();
ROLLBACK;
