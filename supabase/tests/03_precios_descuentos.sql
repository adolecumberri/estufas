-- ============================================================================
-- Test 03: reglas de precios y descuentos + congelación de precios
-- ============================================================================
BEGIN;
SELECT plan(7);

CREATE SCHEMA IF NOT EXISTS tests;

CREATE OR REPLACE FUNCTION tests.authenticate_as(p_sub UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub::text)::text, TRUE);
END;
$$;

-- 1. Anónimo: precio base sin descuentos.
SET LOCAL ROLE anon;
SELECT results_eq(
    $q$ SELECT round(precio_final, 2)::numeric FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000002', NULL) $q$,
    ARRAY[1499.00]::numeric[],
    'anon ve el precio base'
);

-- 2. Empresa (10% general + promo 5%): gana el 10% individual en TF-12.
SET LOCAL ROLE authenticated;
PERFORM tests.authenticate_as('44444444-4444-4444-8444-444444444444');
SELECT results_eq(
    $q$ SELECT descuento_pct::numeric, descuento_origen::varchar, round(precio_final, 2)::numeric
        FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444') $q$,
    $$ VALUES (10.00::numeric, 'cliente_general'::varchar, 1349.10::numeric) $$,
    'empresa: el 10% individual gana a la promo del 5%'
);

-- 3. El 0% específico SUSTITUYE al general del 10% (LP-9 para la empresa).
SELECT results_eq(
    $q$ SELECT descuento_pct::numeric, descuento_origen::varchar, round(precio_final, 2)::numeric
        FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444') $q$,
    $$ VALUES (0.00::numeric, 'cliente_producto'::varchar, 999.00::numeric) $$,
    'el descuento específico 0% sustituye al general'
);

-- 4. Particular sin descuentos individuales: se aplica la promo de tienda (5%).
PERFORM tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT results_eq(
    $q$ SELECT descuento_pct::numeric, descuento_origen::varchar
        FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333') $q$,
    $$ VALUES (5.00::numeric, 'promocion_tienda'::varchar) $$,
    'el cliente sin descuento recibe la promo de tienda'
);

-- 5. Congelación: crear pedido y comprobar la línea.
CREATE TEMP TABLE tmp_pedido AS
SELECT * FROM crear_pedido(NULL, '[{"producto_id":"f1000000-0000-4000-8000-000000000002","cantidad":2}]'::jsonb, NULL);

SELECT results_eq(
    $q$ SELECT descuento_porcentaje::numeric, base_imponible::numeric
        FROM pedido_lineas WHERE pedido_id = (SELECT pedido_id FROM tmp_pedido) $q$,
    $$ VALUES (5.00::numeric, 2848.10::numeric) $$,
    'la línea congela precio, descuento y base imponible'
);

-- 6. Un cambio de precio posterior NO altera el pedido existente.
PERFORM tests.authenticate_as('11111111-1111-4111-8111-111111111111');
PERFORM actualizar_precio('f1000000-0000-4000-8000-000000000002', 2000.00);

SELECT results_eq(
    $q$ SELECT precio_unitario::numeric FROM pedido_lineas
        WHERE pedido_id = (SELECT pedido_id FROM tmp_pedido) $q$,
    ARRAY[1499.00]::numeric[],
    'el cambio de precio no altera la línea congelada'
);

-- 7. Un cliente no puede sondear condiciones de otro cliente.
SET LOCAL ROLE authenticated;
PERFORM tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT throws_ok(
    $q$ SELECT * FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000002',
        '44444444-4444-4444-8444-444444444444') $q$,
    'Sin permiso para consultar las condiciones de ese cliente',
    'un cliente no consulta condiciones ajenas'
);

SELECT * FROM finish();
ROLLBACK;
