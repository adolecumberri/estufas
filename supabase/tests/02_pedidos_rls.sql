-- ============================================================================
-- Test 02: RLS de pedidos por rol
-- ============================================================================
BEGIN;
SELECT plan(5);

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

-- El cliente crea un pedido vía RPC (los permisos se validan en la BD).
SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');

CREATE TEMP TABLE tmp_pedido AS
SELECT * FROM crear_pedido(
    NULL,
    '[{"producto_id":"f1000000-0000-4000-8000-000000000002","cantidad":1}]'::jsonb,
    'pedido de prueba'
);

-- 1. El cliente ve su propio pedido (acotado al pedido del test: la BD puede
--    contener pedidos previos de uso manual).
SELECT results_eq(
    'SELECT count(*)::int FROM pedidos WHERE id = (SELECT pedido_id FROM tmp_pedido)',
    ARRAY[1],
    'el cliente ve su pedido'
);

-- 2. El pedido tiene una línea congelada.
SELECT results_eq(
    'SELECT count(*)::int FROM pedido_lineas WHERE pedido_id = (SELECT pedido_id FROM tmp_pedido)',
    ARRAY[1],
    'el pedido tiene una línea'
);

-- 3. Otro cliente NO ve el pedido.
SELECT tests.authenticate_as('44444444-4444-4444-8444-444444444444');
SELECT results_eq(
    'SELECT count(*)::int FROM pedidos WHERE id = (SELECT pedido_id FROM tmp_pedido)',
    ARRAY[0],
    'otro cliente no ve pedidos ajenos'
);

-- 4. El comercial responsable SÍ lo ve.
SELECT tests.authenticate_as('22222222-2222-4222-8222-222222222222');
SELECT results_eq(
    'SELECT count(*)::int FROM pedidos WHERE id = (SELECT pedido_id FROM tmp_pedido)',
    ARRAY[1],
    'el comercial responsable ve el pedido de su cartera'
);

-- 5. Nadie inserta líneas directamente (solo RPC).
SELECT throws_ok(
    $q$ INSERT INTO pedido_lineas (pedido_id, producto_id, referencia_producto, nombre_producto, cantidad,
            precio_unitario, descuento_porcentaje, descuento_origen, descuento_importe,
            iva_porcentaje, base_imponible, cuota_iva, total_linea)
        VALUES (
            (SELECT pedido_id FROM tmp_pedido),
            'f1000000-0000-4000-8000-000000000002', 'TF-12', 'Estufa', 1,
            100, 0, 'ninguno', 0, 0, 100, 0, 100) $q$,
    'new row violates row-level security policy for table "pedido_lineas"',
    'no se insertan líneas con DML directo'
);

SELECT * FROM finish();
ROLLBACK;
