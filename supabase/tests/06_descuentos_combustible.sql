-- ============================================================================
-- Test 06: descuentos por combustible y su precedencia
-- ============================================================================
BEGIN;
SELECT plan(4);

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

-- Datos de prueba (como postgres, sin RLS): 20% en pellets para el particular.
INSERT INTO descuentos_cliente_combustible (cliente_id, combustible, descuento_porcentaje, creado_por)
VALUES ('33333333-3333-4333-8333-333333333333', 'pellets', 20.00, '22222222-2222-4222-8222-222222222222');

-- 1. El 20% por combustible se aplica a TF-12 (pellets).
SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT results_eq(
    $q$ SELECT descuento_pct::numeric, descuento_origen::varchar, round(precio_final, 2)::numeric
        FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333') $q$,
    $$ VALUES (20.00::numeric, 'cliente_combustible'::varchar, 1199.20::numeric) $$,
    'el descuento por combustible (20% pellets) se aplica a TF-12'
);

-- 2. El descuento específico de producto gana al de combustible (LP-9, 10%).
RESET ROLE;
INSERT INTO descuentos_cliente_producto (cliente_id, producto_id, descuento_porcentaje, creado_por)
VALUES ('33333333-3333-4333-8333-333333333333', 'f1000000-0000-4000-8000-000000000001', 10.00, '22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT results_eq(
    $q$ SELECT descuento_pct::numeric, descuento_origen::varchar, round(precio_final, 2)::numeric
        FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333') $q$,
    $$ VALUES (10.00::numeric, 'cliente_producto'::varchar, 899.10::numeric) $$,
    'el descuento de producto gana al de combustible'
);

-- 3. El descuento por combustible gana al general aunque este sea mayor (25%).
RESET ROLE;
UPDATE usuarios SET descuento_porcentaje = 25.00
WHERE id = '33333333-3333-4333-8333-333333333333';
SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT results_eq(
    $q$ SELECT descuento_pct::numeric, descuento_origen::varchar, round(precio_final, 2)::numeric
        FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333') $q$,
    $$ VALUES (20.00::numeric, 'cliente_combustible'::varchar, 1199.20::numeric) $$,
    'el descuento por combustible precede al general del cliente'
);

-- 4. La promoción de tienda gana si es mayor (30% > 20%).
RESET ROLE;
INSERT INTO promociones_tienda (nombre, descripcion, descuento_porcentaje, activa, creado_por)
VALUES ('Promo Test 30', 'Promoción de prueba del test 06.', 30.00, TRUE, '11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT results_eq(
    $q$ SELECT descuento_pct::numeric, descuento_origen::varchar, round(precio_final, 2)::numeric
        FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333') $q$,
    $$ VALUES (30.00::numeric, 'promocion_tienda'::varchar, 1049.30::numeric) $$,
    'la promoción mayor gana al descuento por combustible'
);

SELECT * FROM finish();
ROLLBACK;
