-- ============================================================================
-- Test 15: el catálogo nunca devuelve productos sin precio vigente (0030)
-- ============================================================================
BEGIN;
SELECT plan(5);

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

-- Datos autocontenidos (como postgres, sin RLS): un producto SIN precio y uno
-- CON precio vigente, ambos activos y del proveedor Eider.
-- (tipo_producto_id es NOT NULL en productos: se usa el tipo Estufa.)
INSERT INTO productos (id, referencia, nombre, slug, tipo_producto_id, destacado, activo, proveedor_id, datos)
VALUES ('f9000000-0000-4000-8000-000000000001', 'T15-SIN', 'Producto sin precio', 't15-sin-precio', 'b1000000-0000-4000-8000-000000000001', FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[]'::jsonb);

INSERT INTO productos (id, referencia, nombre, slug, tipo_producto_id, destacado, activo, proveedor_id, datos)
VALUES ('f9000000-0000-4000-8000-000000000002', 'T15-CON', 'Producto con precio', 't15-con-precio', 'b1000000-0000-4000-8000-000000000001', FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[]'::jsonb);

INSERT INTO producto_precios (producto_id, precio, moneda, fecha_inicio)
VALUES ('f9000000-0000-4000-8000-000000000002', 100.00, 'EUR', fn_hoy());

SET LOCAL ROLE authenticated;
SELECT tests.authenticate_as('33333333-3333-4333-8333-333333333333');

-- 1. El producto SIN precio NO aparece en el catálogo de usuario.
SELECT results_eq(
    $q$ SELECT count(*)::int FROM fn_catalogo_usuario_v2(p_busqueda := 't15-sin') $q$,
    ARRAY[0],
    'fn_catalogo_usuario_v2 excluye el producto sin precio'
);

-- 2. El producto CON precio vigente SÍ aparece.
SELECT results_eq(
    $q$ SELECT count(*)::int FROM fn_catalogo_usuario_v2(p_busqueda := 't15-con') $q$,
    ARRAY[1],
    'fn_catalogo_usuario_v2 incluye el producto con precio vigente'
);

-- 3. El snapshot excluye al sin precio e incluye al con precio.
SELECT ok(
    (SELECT NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(fn_catalogo_snapshot() -> 'productos') e
            WHERE e ->> 'producto_id' = 'f9000000-0000-4000-8000-000000000001'
        )
     AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(fn_catalogo_snapshot() -> 'productos') e
            WHERE e ->> 'producto_id' = 'f9000000-0000-4000-8000-000000000002'
        )),
    'el snapshot aplica el mismo invariante'
);

-- 4. El detalle (la ruta por la que la app añadía al carrito) devuelve 0 filas.
SELECT results_eq(
    $q$ SELECT count(*)::int
        FROM fn_producto_detalle('f9000000-0000-4000-8000-000000000001') $q$,
    ARRAY[0],
    'fn_producto_detalle no devuelve el producto sin precio'
);

-- 5. Y devuelve el producto con precio vigente.
SELECT results_eq(
    $q$ SELECT count(*)::int
        FROM fn_producto_detalle('f9000000-0000-4000-8000-000000000002') $q$,
    ARRAY[1],
    'fn_producto_detalle devuelve el producto con precio vigente'
);

SELECT * FROM finish();
ROLLBACK;
