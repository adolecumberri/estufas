-- ============================================================================
-- Test 01: catálogo público (rol anon)
-- ============================================================================
BEGIN;
SELECT plan(6);

CREATE SCHEMA IF NOT EXISTS tests;

CREATE OR REPLACE FUNCTION tests.authenticate_as(p_sub UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub::text)::text, TRUE);
END;
$$;

SET LOCAL ROLE anon;

-- 1. El visitante ve los productos publicados (6; el borrador TF-X queda oculto).
SELECT results_eq(
    'SELECT count(*)::int FROM productos',
    ARRAY[6],
    'anon ve solo los productos publicados'
);

-- 2. No ve usuarios.
SELECT results_eq(
    'SELECT count(*)::int FROM usuarios',
    ARRAY[0],
    'anon no ve usuarios'
);

-- 3. No ve pedidos.
SELECT results_eq(
    'SELECT count(*)::int FROM pedidos',
    ARRAY[0],
    'anon no ve pedidos'
);

-- 4. La vista pública de precios solo expone el catálogo publicado.
SELECT results_eq(
    'SELECT count(*)::int FROM v_productos_precio_vigente',
    ARRAY[6],
    'la vista pública expone 6 productos'
);

-- 5. No puede insertar pedidos directamente (RLS lo rechaza).
SELECT throws_ok(
    $q$ INSERT INTO pedidos (cliente_id, creado_por)
         VALUES ('33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333') $q$,
    'new row violates row-level security policy for table "pedidos"',
    'anon no puede insertar pedidos'
);

-- 6. La vista de descuentos no está expuesta (REVOKE).
SELECT throws_ok(
    $q$ SELECT * FROM v_descuentos_cliente_producto_vigentes $q$,
    'permission denied for view v_descuentos_cliente_producto_vigentes',
    'la vista de descuentos no es accesible para anon'
);

SELECT * FROM finish();
ROLLBACK;
