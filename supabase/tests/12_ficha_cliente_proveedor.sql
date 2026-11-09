-- ============================================================================
-- Test 12: ficha de cliente — categorías y productos por proveedor (0027)
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

-- Comercial 2222 tiene Eider y Fansa habilitados (seed); el cliente 3333 es
-- suyo. El comercial 6666 solo tiene Fansa.

-- 1. Las categorías de Eider son EXACTAMENTE las derivadas de sus productos
--    (producto_categoria, deduplicadas, ordenadas por grupo/orden/nombre).
--    En el seed actual Eider tiene estufas (Combustible/Estilo/Instalación)
--    y la gama de accesorios (Gama): 12 categorías, no solo las 5 gamas.
SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('22222222-2222-4222-8222-222222222222');
SELECT results_eq(
    $q$ SELECT nombre::text FROM fn_categorias_proveedor('91000000-0000-4000-8000-000000000004') $q$,
    $$ VALUES
        ('Pellet'::text), ('Leña'::text), ('Aire'::text),
        ('Fundición'::text), ('Hogares'::text),
        ('Combustible'::text), ('Fuego'::text), ('Fuego EKO'::text),
        ('Citronela'::text), ('Cerillas y mecheros'::text),
        ('Insertable'::text), ('Ventilada'::text) $$,
    'las categorías de Eider son las derivadas de sus productos'
);

-- 2. Fansa solo tiene su categoría de accesorios.
SELECT results_eq(
    $q$ SELECT nombre::text FROM fn_categorias_proveedor('91000000-0000-4000-8000-000000000005') $q$,
    $$ VALUES ('Accesorios'::text) $$,
    'las categorías de Fansa se derivan de sus productos'
);

-- 3. Productos de Eider con búsqueda 'pellets': solo los 2 sacos. El precio
--    final del cliente incluye la promoción activa del seed (Promo Bienvenida
--    5%): 3.75 × 0.95 = 3.56 (fn_calcular_precio, el cliente 3333 no tiene
--    descuentos propios).
SELECT results_eq(
    $q$ SELECT nombre::text, precio_base::numeric, precio_final::numeric
        FROM fn_productos_proveedor(
            '33333333-3333-4333-8333-333333333333',
            '91000000-0000-4000-8000-000000000004',
            'pellets', 20) $q$,
    $$ VALUES
        ('Saco De Pellets 15 Kg Biofire'::text, 3.75::numeric, 3.56::numeric),
        ('Saco De Pellets 15 Kg Fireplus'::text, 3.75::numeric, 3.56::numeric) $$,
    'los productos de Eider se filtran por búsqueda con precio del cliente'
);

-- 4. La búsqueda de Fansa solo devuelve productos que coinciden.
SELECT ok(
    (SELECT count(*) = 0
       FROM fn_productos_proveedor(
           '33333333-3333-4333-8333-333333333333',
           '91000000-0000-4000-8000-000000000005',
           'maceta', 50) x
      WHERE x.nombre NOT ILIKE '%maceta%'),
    'la búsqueda de Fansa devuelve solo coincidencias'
);

-- 5. Un comercial SIN el proveedor habilitado no ve sus categorías.
SELECT tests.authenticate_as('66666666-6666-4666-8666-666666666666');
SELECT throws_ok(
    $q$ SELECT fn_categorias_proveedor('91000000-0000-4000-8000-000000000004') $q$,
    'Sin acceso a este proveedor',
    'sin proveedor habilitado no hay categorías'
);

-- 6. Un comercial no responsable del cliente no consulta sus condiciones.
SELECT throws_ok(
    $q$ SELECT fn_productos_proveedor(
            '33333333-3333-4333-8333-333333333333',
            '91000000-0000-4000-8000-000000000005', NULL, 10) $q$,
    'Sin permiso para consultar las condiciones de ese cliente',
    'sin responsabilidad sobre el cliente no hay productos'
);

-- 7. El admin consulta productos de cualquier proveedor para un cliente.
SELECT tests.authenticate_as('11111111-1111-4111-8111-111111111111');
SELECT results_eq(
    $q$ SELECT count(*)::int
        FROM fn_productos_proveedor(
            '33333333-3333-4333-8333-333333333333',
            '91000000-0000-4000-8000-000000000005', NULL, 5) $q$,
    $$ VALUES (5::int) $$,
    'el admin consulta productos por proveedor para un cliente'
);

SELECT * FROM finish();
ROLLBACK;
