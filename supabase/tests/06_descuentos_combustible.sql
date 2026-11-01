-- ============================================================================
-- Test 06: descuentos por combustible — LEGACY (retirado de la precedencia)
--
-- Decisión cerrada: la cadena de descuentos es producto > categoría >
-- proveedor > general. El nivel "combustible" (0006) queda RETIRADO de
-- fn_calcular_precio; la tabla se conserva por datos históricos.
-- ============================================================================
BEGIN;
SELECT plan(3);

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

-- Datos (como postgres, sin RLS): descuento legacy del 20% en pellets para el
-- particular. El particular no tiene general ni otros descuentos: solo la
-- promo de tienda del seed (5%).
INSERT INTO descuentos_cliente_combustible (cliente_id, combustible, descuento_porcentaje, creado_por)
VALUES ('33333333-3333-4333-8333-333333333333', 'pellets', 20.00, '22222222-2222-4222-8222-222222222222');

SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');

-- 1. El descuento por combustible YA NO altera el precio: TF-12 queda con la
--    promo de tienda (5%), no con el 20% legacy.
SELECT results_eq(
    $q$ SELECT descuento_pct::numeric, descuento_origen::varchar, round(precio_final, 2)::numeric
        FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333') $q$,
    $$ VALUES (5.00::numeric, 'promocion_tienda'::varchar, 1424.05::numeric) $$,
    'el descuento por combustible ya no se aplica (legacy)'
);

-- 2. La tabla sigue existiendo (datos históricos).
SELECT ok(
    (SELECT to_regclass('public.descuentos_cliente_combustible') IS NOT NULL),
    'la tabla descuentos_cliente_combustible sigue existiendo (legacy)'
);

-- 3. El origen cliente_combustible ya no sale de fn_calcular_precio.
SELECT results_eq(
    $q$ SELECT count(*)::int
        FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333')
        WHERE descuento_origen = 'cliente_combustible' $q$,
    ARRAY[0],
    'el origen cliente_combustible ya no aparece en los precios'
);

SELECT * FROM finish();
ROLLBACK;
