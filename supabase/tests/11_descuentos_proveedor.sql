-- ============================================================================
-- Test 11: descuentos por proveedor/categoría — precedencia y auditoría
-- ============================================================================
BEGIN;
SELECT plan(8);

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

-- Datos (como postgres, sin RLS): cliente 3333 con general 50%, proveedor
-- Eider 40%, categoría pellet-Eider 30%, categoría insertable-Eider 10%,
-- categoría insertable-FANSA 25% (no debe aplicar a productos Eider) y
-- producto LP-9 5%. Promos desactivadas para aislar la precedencia.
UPDATE usuarios SET descuento_porcentaje = 50.00
WHERE id = '33333333-3333-4333-8333-333333333333';

INSERT INTO descuentos_cliente_proveedor (cliente_id, proveedor_id, descuento_porcentaje) VALUES
('33333333-3333-4333-8333-333333333333', '91000000-0000-4000-8000-000000000004', 40.00);

INSERT INTO descuentos_cliente_categoria (cliente_id, proveedor_id, categoria_id, descuento_porcentaje) VALUES
('33333333-3333-4333-8333-333333333333', '91000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 30.00),
('33333333-3333-4333-8333-333333333333', '91000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004', 10.00),
('33333333-3333-4333-8333-333333333333', '91000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000004', 25.00);

INSERT INTO descuentos_cliente_producto (cliente_id, producto_id, descuento_porcentaje) VALUES
('33333333-3333-4333-8333-333333333333', 'f1000000-0000-4000-8000-000000000001', 5.00);

UPDATE promociones_tienda SET activa = FALSE;

SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');

-- 1. El MÁS PRECISO gana aunque su % sea menor: producto 5% vs categoría 30%,
--    proveedor 40% y general 50% → gana el producto (5%).
SELECT results_eq(
    $q$ SELECT descuento_pct::numeric, descuento_origen::varchar, round(precio_final, 2)::numeric
        FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333') $q$,
    $$ VALUES (5.00::numeric, 'cliente_producto'::varchar, 949.05::numeric) $$,
    'el descuento de producto gana a categoría, proveedor y general'
);

-- 2. Categoría (30%) gana al proveedor (40%) por precisión y NO se acumulan.
--    TF-12 solo tiene la categoría pellet, así que la categoría aplicable es
--    exactamente una (sin mezcla con otras categorías del producto).
SELECT results_eq(
    $q$ SELECT descuento_pct::numeric, descuento_origen::varchar, round(precio_final, 2)::numeric
        FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333') $q$,
    $$ VALUES (30.00::numeric, 'cliente_categoria'::varchar, 1049.30::numeric) $$,
    'la categoría gana al proveedor aunque el % sea menor (sin acumular)'
);

-- 3. La categoría está ACOTADA al proveedor del producto: sin categoría Eider
--    que aplique a TF-12, la categoría insertable de FANSA (25%) NO aplica y
--    cae al descuento por proveedor (Eider 40%).
--    (El DELETE se hace como postgres: un cliente no tiene política DELETE y
--    un DELETE filtrado por RLS no borraría fila alguna.)
RESET ROLE;
DELETE FROM descuentos_cliente_categoria
WHERE cliente_id = '33333333-3333-4333-8333-333333333333'
  AND proveedor_id = '91000000-0000-4000-8000-000000000004'
  AND categoria_id = 'c1000000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT results_eq(
    $q$ SELECT descuento_pct::numeric, descuento_origen::varchar, round(precio_final, 2)::numeric
        FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333') $q$,
    $$ VALUES (40.00::numeric, 'cliente_proveedor'::varchar, 899.40::numeric) $$,
    'la categoría de otro proveedor no aplica; cae al descuento por proveedor'
);

-- 4. El 0% específico SUSTITUYE (sin promo activa, el 0% queda).
--    (El INSERT se hace como postgres: un cliente no tiene política INSERT.)
RESET ROLE;
INSERT INTO descuentos_cliente_producto (cliente_id, producto_id, descuento_porcentaje) VALUES
('33333333-3333-4333-8333-333333333333', 'f1000000-0000-4000-8000-000000000002', 0.00);

SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT results_eq(
    $q$ SELECT descuento_pct::numeric, descuento_origen::varchar, round(precio_final, 2)::numeric
        FROM fn_calcular_precio('f1000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333') $q$,
    $$ VALUES (0.00::numeric, 'cliente_producto'::varchar, 1499.00::numeric) $$,
    'el 0% específico sustituye a categoría, proveedor y general'
);

-- 5. El ADMIN escribe un descuento en un cliente de un comercial y el
--    historial registra el actor real y su rol.
SELECT tests.authenticate_as('11111111-1111-4111-8111-111111111111');
SELECT fn_upsert_descuento_proveedor(
    '33333333-3333-4333-8333-333333333333',
    '91000000-0000-4000-8000-000000000004',
    12.00
);
SELECT results_eq(
    $q$ SELECT actor_id::text || '|' || actor_rol::text
        FROM descuentos_historial
        WHERE nivel = 'proveedor' AND actor_id IS NOT NULL
        ORDER BY id DESC LIMIT 1 $q$,
    ARRAY['11111111-1111-4111-8111-111111111111|admin'],
    'el historial registra al admin como actor real'
);

-- 6. Un cliente NO puede escribir descuentos (ni los suyos).
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT throws_ok(
    $q$ SELECT fn_upsert_descuento_proveedor(
        '33333333-3333-4333-8333-333333333333',
        '91000000-0000-4000-8000-000000000005',
        15.00) $q$,
    'Sin permiso para modificar descuentos de este cliente',
    'un cliente no escribe descuentos'
);

-- 7. El COMERCIAL escribe para su cliente y el historial registra su rol.
SELECT tests.authenticate_as('22222222-2222-4222-8222-222222222222');
SELECT fn_upsert_descuento_proveedor(
    '33333333-3333-4333-8333-333333333333',
    '91000000-0000-4000-8000-000000000005',
    7.00
);
SELECT results_eq(
    $q$ SELECT actor_id::text || '|' || actor_rol::text
        FROM descuentos_historial
        WHERE nivel = 'proveedor' AND actor_id IS NOT NULL
        ORDER BY id DESC LIMIT 1 $q$,
    ARRAY['22222222-2222-4222-8222-222222222222|comercial'],
    'el historial registra al comercial como actor real'
);

-- 8. fn_descuentos_cuenta expone las listas nuevas.
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT ok(
    (SELECT jsonb_array_length(fn_descuentos_cuenta(NULL) -> 'categorias') > 0
        AND jsonb_array_length(fn_descuentos_cuenta(NULL) -> 'proveedores') > 0),
    'la cuenta devuelve las listas de categorías y proveedores'
);

SELECT * FROM finish();
ROLLBACK;
