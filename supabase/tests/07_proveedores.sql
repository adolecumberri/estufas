-- ============================================================================
-- Test 07: multi-empresa — proveedores, visibilidad y pedidos sin mezcla
-- (mundo de DOS proveedores: Eider 004 y Fansa 005)
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

-- 1. No se pueden mezclar proveedores en un pedido (LP-9 Eider + NA150SZ Fansa).
SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT throws_ok(
    $q$ SELECT * FROM crear_pedido(NULL,
        '[{"producto_id":"f1000000-0000-4000-8000-000000000001","cantidad":1},
          {"producto_id":"f3000000-0000-4000-8000-000000000001","cantidad":1}]'::jsonb, NULL) $q$,
    'No se pueden mezclar proveedores en un pedido',
    'no se mezclan proveedores en un pedido'
);

-- 1b. El seed marca al 2222 como catálogo general (0020) con TODOS los
--     proveedores: aquí se le quita Fansa para probar el rechazo por no
--     habilitado (el test 4 se lo devolverá).
SELECT tests.authenticate_as('11111111-1111-4111-8111-111111111111');
SELECT desasignar_proveedor_comercial(
    '22222222-2222-4222-8222-222222222222',
    '91000000-0000-4000-8000-000000000005'
);
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
-- 2. Fansa no está habilitado para el comercial 2222 (FAN-001 rechazado).
SELECT throws_ok(
    $q$ SELECT * FROM crear_pedido(NULL,
        '[{"producto_id":"f3000000-0000-4000-8000-000000000595","cantidad":1}]'::jsonb, NULL) $q$,
    'El proveedor no está habilitado para este comercial',
    'el proveedor no habilitado bloquea el pedido'
);

-- 3. El catálogo del cliente particular (comercial 2222) muestra Eider y
--    oculta Fansa.
SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2(NULL, NULL, NULL, NULL, 5000, 0, NULL)
        WHERE referencia IN ('LP-9', 'NA150SZ')
        ORDER BY referencia $q$,
    ARRAY['LP-9'],
    'el cliente ve Eider pero no Fansa'
);

-- 4. El admin habilita Fansa al comercial 2222 y NA150SZ aparece.
SELECT tests.authenticate_as('11111111-1111-4111-8111-111111111111');
SELECT asignar_proveedor_comercial(
    '22222222-2222-4222-8222-222222222222',
    '91000000-0000-4000-8000-000000000005'
);
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2(NULL, NULL, NULL, NULL, 5000, 0, NULL)
        WHERE referencia IN ('LP-9', 'NA150SZ')
        ORDER BY referencia $q$,
    ARRAY['LP-9', 'NA150SZ'],
    'tras habilitar Fansa, el cliente ve sus productos'
);

-- 5. El pedido congela el proveedor de sus líneas (TF-12 → Eider).
CREATE TEMP TABLE tmp_pedido AS
SELECT * FROM crear_pedido(NULL,
    '[{"producto_id":"f1000000-0000-4000-8000-000000000002","cantidad":1}]'::jsonb, NULL);

SELECT results_eq(
    $q$ SELECT proveedor_id::text FROM pedidos
        WHERE id = (SELECT pedido_id FROM tmp_pedido) $q$,
    ARRAY['91000000-0000-4000-8000-000000000004'],
    'el pedido guarda el proveedor de sus líneas'
);

-- 6. Un proveedor inactivo oculta sus productos (Eider → activo FALSE).
SELECT tests.authenticate_as('11111111-1111-4111-8111-111111111111');
SELECT actualizar_proveedor(
    '91000000-0000-4000-8000-000000000004',
    NULL, NULL, NULL, NULL, FALSE
);
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2(NULL, NULL, NULL, NULL, 5000, 0, NULL)
        WHERE referencia IN ('LP-9', 'NA150SZ')
        ORDER BY referencia $q$,
    ARRAY['NA150SZ'],
    'un proveedor inactivo oculta sus productos'
);

-- 7. El proveedor de un pedido queda congelado al editarlo (Eider → Fansa).
--    Se reactiva antes Eider (el test 6 lo desactivó) para que la validación
--    que se prueba aquí sea la de congelación, no la de disponibilidad.
SELECT tests.authenticate_as('11111111-1111-4111-8111-111111111111');
SELECT actualizar_proveedor(
    '91000000-0000-4000-8000-000000000004',
    NULL, NULL, NULL, NULL, TRUE
);
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');
SELECT throws_ok(
    $q$ SELECT editar_pedido((SELECT pedido_id FROM tmp_pedido),
        '[{"producto_id":"f3000000-0000-4000-8000-000000000001","cantidad":1}]'::jsonb) $q$,
    'No se puede cambiar el proveedor del pedido',
    'no se cambia el proveedor congelado del pedido'
);

-- 8. Un cliente sin comercial no ve productos con proveedor ni puede pedirlos
--    (suelto@estufas.local del seed, sin id_comercial).
SELECT tests.authenticate_as('88888888-8888-4888-8888-888888888888');
SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2(NULL, NULL, NULL, NULL, 5000, 0, NULL)
        ORDER BY referencia $q$,
    ARRAY[]::text[],
    'un cliente sin comercial no ve productos con proveedor asignado'
);
SELECT throws_ok(
    $q$ SELECT * FROM crear_pedido(NULL,
        '[{"producto_id":"f1000000-0000-4000-8000-000000000002","cantidad":1}]'::jsonb, NULL) $q$,
    'El cliente no tiene comercial asignado',
    'un cliente sin comercial no puede pedir productos con proveedor'
);

SELECT * FROM finish();
ROLLBACK;
