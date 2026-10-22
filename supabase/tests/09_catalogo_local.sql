-- ============================================================================
-- Test 09: catálogo local — versión, snapshot y descuentos de cuenta
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

GRANT USAGE ON SCHEMA tests TO anon, authenticated;
GRANT EXECUTE ON FUNCTION tests.authenticate_as(UUID) TO anon, authenticated;

-- 1. fn_catalogo_version() devuelve un entero >= 1.
SELECT results_eq(
    $q$ SELECT fn_catalogo_version() >= 1 $q$,
    ARRAY[TRUE],
    'fn_catalogo_version devuelve un entero >= 1'
);

-- 2. Cambiar un precio (actualizar_precio como admin) INCREMENTA la versión.
SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('11111111-1111-4111-8111-111111111111');
CREATE TEMP TABLE tmp_ver AS SELECT fn_catalogo_version() AS v0;
SELECT actualizar_precio('f1000000-0000-4000-8000-000000000002', 2000.00);
SELECT results_eq(
    $q$ SELECT fn_catalogo_version() > (SELECT v0 FROM tmp_ver) $q$,
    ARRAY[TRUE],
    'actualizar_precio incrementa la versión del catálogo'
);

-- 3. fn_catalogo_snapshot(): productos > 0, cada uno con precio_base y
--    precios_transporte como objeto.
SET LOCAL ROLE anon;
SELECT ok(
    (SELECT jsonb_array_length(fn_catalogo_snapshot() -> 'productos') > 0),
    'el snapshot trae productos'
);
SELECT ok(
    (SELECT bool_and(
                (p ->> 'precio_base') IS NOT NULL
                AND jsonb_typeof(p -> 'precios_transporte') = 'object'
            )
     FROM jsonb_array_elements(fn_catalogo_snapshot() -> 'productos') p),
    'cada producto trae precio_base y precios_transporte objeto'
);

-- 4. fn_descuentos_cuenta para la empresa (4444): general 10% y promo 5%.
SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('44444444-4444-4444-8444-444444444444');
SELECT results_eq(
    $q$ SELECT (fn_descuentos_cuenta(NULL) ->> 'general_pct')::numeric,
                (fn_descuentos_cuenta(NULL) ->> 'promo_pct')::numeric $q$,
    $$ VALUES (10.00::numeric, 5.00::numeric) $$,
    'la empresa tiene general 10% y promo 5%'
);

-- 5. Un cliente no puede consultar las condiciones de otro cliente.
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT throws_ok(
    $q$ SELECT fn_descuentos_cuenta('44444444-4444-4444-8444-444444444444') $q$,
    'Sin permiso para consultar las condiciones de ese cliente',
    'un cliente no consulta las condiciones de otro'
);

SELECT * FROM finish();
ROLLBACK;
