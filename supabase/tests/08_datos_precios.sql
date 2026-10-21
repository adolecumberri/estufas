-- ============================================================================
-- Test 08: datos técnicos JSONB y precios por transporte (0009)
-- ============================================================================
BEGIN;
SELECT plan(4);

CREATE SCHEMA IF NOT EXISTS tests;

SET LOCAL ROLE anon;

-- 1-2. Los productos SIN categoría de combustible (gama Eider) son visibles
--      tanto en pellets como en leña (agnósticos).
SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2(NULL, 'pellets', NULL, NULL, 200, 0, NULL)
        WHERE referencia = 'EID-001' $q$,
    ARRAY['EID-001'],
    'el producto agnóstico aparece en pellets'
);

SELECT results_eq(
    $q$ SELECT referencia::text
        FROM fn_catalogo_usuario_v2(NULL, 'lena', NULL, NULL, 200, 0, NULL)
        WHERE referencia = 'EID-001' $q$,
    ARRAY['EID-001'],
    'el producto agnóstico aparece en leña'
);

-- 3. El catálogo devuelve los precios por transporte del producto.
SELECT results_eq(
    $q$ SELECT (precios_transporte->>'camion')::numeric
        FROM fn_catalogo_usuario_v2(NULL, 'pellets', NULL, NULL, 200, 0, NULL)
        WHERE referencia = 'EID-001' $q$,
    ARRAY[3.75::numeric],
    'el catálogo incluye el precio camión del transporte'
);

-- 4. La ficha devuelve los datos técnicos JSONB agrupados.
SELECT results_eq(
    $q$ SELECT (datos #>> '{0,grupo}') || ':' || (datos #>> '{0,filas,0,clave}')
        FROM fn_producto_detalle('f2000000-0000-4000-8000-000000000001', NULL) $q$,
    ARRAY['Datos generales:peso'],
    'la ficha devuelve el grupo y la fila de datos'
);

SELECT * FROM finish();
ROLLBACK;
