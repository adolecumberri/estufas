-- ============================================================================
-- 0008: admite 'cliente_combustible' en pedido_lineas.descuento_origen
--
-- La migración 0006 añadió el origen de descuento por combustible, pero el
-- CHECK de pedido_lineas (0001) no lo incluía: crear un pedido con un
-- descuento por combustible fallaba al insertar las líneas congeladas.
-- ============================================================================

ALTER TABLE pedido_lineas
    DROP CONSTRAINT IF EXISTS pedido_lineas_descuento_origen_check;

ALTER TABLE pedido_lineas
    ADD CONSTRAINT chk_pedido_lineas_descuento_origen
        CHECK (descuento_origen IN (
            'ninguno',
            'cliente_general',
            'cliente_producto',
            'cliente_combustible',
            'promocion_tienda',
            'ajuste_comercial'
        ));
