-- ============================================================================
-- Test 14: fn_filtros_proveedor (0029) — combustibles y categorías POR
-- proveedor para el menú lateral del catálogo (camino de red).
-- (Las comparaciones usan `clave` ASCII para no depender del encoding del
-- cliente psql con literales acentuados.)
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

GRANT USAGE ON SCHEMA tests TO anon, authenticated;
GRANT EXECUTE ON FUNCTION tests.authenticate_as(UUID) TO anon, authenticated;

-- La función es SECURITY DEFINER y pública: cualquier rol puede leerla.
SET LOCAL ROLE authenticated;

-- 1. Eider devuelve exactamente los combustibles lena y pellets.
SELECT set_eq(
    $q$ SELECT unnest(combustibles) FROM fn_filtros_proveedor('91000000-0000-4000-8000-000000000004') $q$,
    $q$ SELECT unnest(ARRAY['lena', 'pellets']) $q$,
    'Eider devuelve lena y pellets'
);

-- 2. Eider incluye la categoría de pellets 'aire'.
SELECT ok(
    EXISTS (
        SELECT 1
        FROM fn_filtros_proveedor('91000000-0000-4000-8000-000000000004'),
             jsonb_array_elements(categorias) c
        WHERE c->>'clave' = 'aire'
    ),
    'Eider incluye aire (pellets)'
);

-- 3. Eider incluye la categoría de leña 'fundicion'.
SELECT ok(
    EXISTS (
        SELECT 1
        FROM fn_filtros_proveedor('91000000-0000-4000-8000-000000000004'),
             jsonb_array_elements(categorias) c
        WHERE c->>'clave' = 'fundicion'
    ),
    'Eider incluye fundicion (leña)'
);

-- 4. Eider NO incluye categorías de Fansa.
SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM fn_filtros_proveedor('91000000-0000-4000-8000-000000000004'),
             jsonb_array_elements(categorias) c
        WHERE c->>'clave' = 'accesorio'
    ),
    'Eider no incluye categorías de Fansa'
);

-- 5. Fansa no tiene combustibles.
SELECT is(
    (SELECT cardinality(combustibles) FROM fn_filtros_proveedor('91000000-0000-4000-8000-000000000005')),
    0,
    'Fansa no tiene combustibles'
);

-- 6. Fansa devuelve exactamente las categorías de sus productos.
SELECT set_eq(
    $q$ SELECT c->>'clave'
         FROM fn_filtros_proveedor('91000000-0000-4000-8000-000000000005'),
              jsonb_array_elements(categorias) c $q$,
    $q$ SELECT DISTINCT c.clave
         FROM productos p
         JOIN producto_categoria pc ON pc.producto_id = p.id AND pc.borrado = FALSE
         JOIN categorias c ON c.id = pc.categoria_id AND c.borrado = FALSE
        WHERE p.proveedor_id = '91000000-0000-4000-8000-000000000005'
          AND p.activo = TRUE AND p.borrado = FALSE
        ORDER BY c.clave $q$,
    'Fansa: categorías exactamente las de sus productos'
);

-- 7. Sin proveedor (NULL) cubre a todos los proveedores.
SELECT ok(
    EXISTS (
        SELECT 1
        FROM fn_filtros_proveedor(NULL),
             jsonb_array_elements(categorias) c
        WHERE c->>'clave' = 'aire'
    )
    AND EXISTS (
        SELECT 1
        FROM fn_filtros_proveedor(NULL),
             jsonb_array_elements(categorias) c
        WHERE c->>'clave' = 'accesorio'
    ),
    'NULL cubre las categorías de todos los proveedores'
);

SELECT * FROM finish();
ROLLBACK;
