-- ============================================================================
-- Test 05: catálogo por combustible (fn_catalogo_usuario_v2, rol anon)
-- ============================================================================
BEGIN;
SELECT plan(4);

CREATE SCHEMA IF NOT EXISTS tests;

SET LOCAL ROLE anon;

-- 1. combustible = pellets: LP-9, TF-12, TF-70 (+ LA-5, que también es pellets
--    por su categoría 'aire').
SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2(NULL, 'pellets', NULL, NULL, 200, 0, NULL)
        ORDER BY referencia $q$,
    ARRAY['LA-5', 'LP-9', 'TF-12', 'TF-70'],
    'pellets devuelve las referencias de pellet'
);

-- 2. combustible = lena: LL-7, EF-8 (+ LA-5, que también es lena por su
--    categoría 'ventilada').
SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2(NULL, 'lena', NULL, NULL, 200, 0, NULL)
        ORDER BY referencia $q$,
    ARRAY['EF-8', 'LA-5', 'LL-7'],
    'lena devuelve las referencias de leña'
);

-- 3. La búsqueda cruza combustibles cuando p_combustible IS NULL: 'Lume'
--    coincide con LP-9 (pellets), LL-7 (lena) y LA-5 (ambas).
SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2('Lume', NULL, NULL, NULL, 200, 0, NULL)
        ORDER BY referencia $q$,
    ARRAY['LA-5', 'LL-7', 'LP-9'],
    'la búsqueda sin combustible cruza pellets y leña'
);

-- 4. p_categoria sigue filtrando dentro del combustible: pellets + insertable
--    solo deja TF-70.
SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2(
                 NULL, 'pellets', 'c1000000-0000-4000-8000-000000000004',
                 NULL, 200, 0, NULL)
        ORDER BY referencia $q$,
    ARRAY['TF-70'],
    'p_categoria filtra dentro del combustible'
);

SELECT * FROM finish();
ROLLBACK;
