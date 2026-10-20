-- ============================================================================
-- 0003: Funciones RPC de negocio
--
-- Todas son SECURITY DEFINER y validan permisos internamente (PRD §10.3:
-- no se confía en datos enviados por el cliente). La aplicación (web y móvil)
-- llama a estas funciones con supabase-js (.rpc); NO hay DML directo sobre
-- pedidos, líneas, descuentos ni usuarios.
--
-- Regla de descuentos implementada (PRD §6.3 + nota 4 del esquema v0.5):
--   1. Precio base vigente (sin IVA).
--   2. El descuento específico cliente/producto SUSTITUYE al general del cliente
--      (una fila con 0% es una excepción válida).
--   3. Después se compara con la mejor promoción de tienda vigente y gana el
--      porcentaje MAYOR. Nunca se acumulan. (Supuesto documentado: resuelve
--      provisionalmente la decisión pendiente nº 1 del PRD.)
--
-- SUPUESTO MVP (PRD §14-4 pendiente): IVA = 0% en las líneas; los precios de
-- catálogo son SIN IVA y los impuestos no se muestran en las fichas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Núcleo de tarifas: precio efectivo de un producto para un cliente.
-- El llamante solo puede consultar sus propias condiciones o las de un
-- cliente asignado (comercial) — nada de sondear descuentos ajenos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calcular_precio(p_producto UUID, p_cliente UUID DEFAULT NULL)
RETURNS TABLE (
    precio_base NUMERIC,
    descuento_pct NUMERIC,
    descuento_origen VARCHAR,
    precio_final NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_base   NUMERIC(12,2);
    v_gen    NUMERIC(5,2) := 0;
    v_esp    NUMERIC(5,2);
    v_promo  NUMERIC(5,2) := 0;
    v_disc   NUMERIC(5,2) := 0;
    v_origen VARCHAR(30) := 'ninguno';
    v_uid    UUID := auth.uid();
BEGIN
    IF p_cliente IS NOT NULL THEN
        IF NOT (fn_es_admin() OR p_cliente = v_uid OR fn_comercial_responsable(p_cliente)) THEN
            RAISE EXCEPTION 'Sin permiso para consultar las condiciones de ese cliente';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM usuarios WHERE id = p_cliente AND rol = 'cliente' AND borrado = FALSE
        ) THEN
            RAISE EXCEPTION 'El cliente % no existe o no está activo', p_cliente;
        END IF;
    END IF;

    SELECT precio INTO v_base
    FROM v_productos_precio_vigente
    WHERE producto_id = p_producto;

    IF v_base IS NULL THEN
        RAISE EXCEPTION 'El producto % no está publicado o no tiene precio vigente', p_producto;
    END IF;

    IF p_cliente IS NOT NULL THEN
        SELECT descuento_porcentaje INTO v_gen
        FROM usuarios WHERE id = p_cliente;

        SELECT descuento_porcentaje INTO v_esp
        FROM v_descuentos_cliente_producto_vigentes
        WHERE cliente_id = p_cliente AND producto_id = p_producto;

        SELECT COALESCE(MAX(descuento_porcentaje), 0) INTO v_promo
        FROM v_promociones_tienda_vigentes;

        IF v_esp IS NOT NULL THEN
            v_disc := v_esp;
            v_origen := 'cliente_producto';
        ELSIF v_gen > 0 THEN
            v_disc := v_gen;
            v_origen := 'cliente_general';
        END IF;

        IF v_promo > v_disc THEN
            v_disc := v_promo;
            v_origen := 'promocion_tienda';
        END IF;
    END IF;

    precio_base := v_base;
    descuento_pct := v_disc;
    descuento_origen := v_origen;
    precio_final := round(v_base * (1 - v_disc / 100.0), 2);
    RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Catálogo para el usuario actual: precios públicos (anónimo) o condiciones
-- efectivas (cliente autenticado). El comercial/admin navega a precio base.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_catalogo_usuario(
    p_busqueda  TEXT DEFAULT NULL,
    p_categoria UUID DEFAULT NULL,
    p_marca     UUID DEFAULT NULL,
    p_limite    INT DEFAULT 100,
    p_offset    INT DEFAULT 0,
    p_cliente   UUID DEFAULT NULL
)
RETURNS TABLE (
    producto_id        UUID,
    referencia         VARCHAR,
    nombre             VARCHAR,
    slug               VARCHAR,
    descripcion        TEXT,
    marca              VARCHAR,
    tipo               VARCHAR,
    categorias         TEXT[],
    etiqueta_energetica VARCHAR,
    destacado          BOOLEAN,
    precio_base        NUMERIC,
    precio_final       NUMERIC,
    descuento_pct      NUMERIC,
    descuento_origen   VARCHAR,
    moneda             CHAR,
    imagen_url         TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cliente UUID;
BEGIN
    -- Un comercial puede consultar el catálogo con las condiciones de un
    -- cliente asignado (para crear pedidos en su nombre).
    IF p_cliente IS NOT NULL
       AND NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente)) THEN
        RAISE EXCEPTION 'Sin permiso para consultar las condiciones de ese cliente';
    END IF;

    IF fn_es_comercial() OR fn_es_admin() THEN
        v_cliente := p_cliente; -- NULL => precios base
    ELSE
        v_cliente := auth.uid();
        IF v_cliente IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM usuarios WHERE id = v_cliente AND rol = 'cliente' AND borrado = FALSE) THEN
            v_cliente := NULL;
        END IF;
    END IF;

    IF p_limite IS NULL OR p_limite <= 0 OR p_limite > 200 THEN p_limite := 200; END IF;
    IF p_offset IS NULL OR p_offset < 0 THEN p_offset := 0; END IF;

    RETURN QUERY
    SELECT
        v.producto_id,
        v.referencia,
        v.nombre,
        v.slug,
        v.descripcion,
        m.nombre,
        t.nombre,
        ARRAY(
            SELECT c2.nombre
            FROM producto_categoria pc2
            JOIN categorias c2 ON c2.id = pc2.categoria_id AND c2.borrado = FALSE
            WHERE pc2.producto_id = v.producto_id AND pc2.borrado = FALSE
            ORDER BY c2.orden, c2.nombre
        ),
        v.etiqueta_energetica,
        p.destacado,
        v.precio,
        COALESCE(d.precio_final, v.precio),
        COALESCE(d.descuento_pct, 0),
        COALESCE(d.descuento_origen, 'ninguno'),
        v.moneda,
        (SELECT r.url FROM recursos r WHERE r.id = v.imagen_principal_id)
    FROM v_productos_precio_vigente v
    JOIN productos p ON p.id = v.producto_id
    LEFT JOIN marcas m ON m.id = p.marca_id
    LEFT JOIN tipos_producto t ON t.id = v.tipo_producto_id
    LEFT JOIN LATERAL fn_calcular_precio(v.producto_id, v_cliente) d ON TRUE
    WHERE v.precio IS NOT NULL
      AND (p_busqueda IS NULL
           OR v.nombre ILIKE '%' || p_busqueda || '%'
           OR v.referencia ILIKE '%' || p_busqueda || '%')
      AND (p_categoria IS NULL OR EXISTS (
            SELECT 1 FROM producto_categoria pc
            WHERE pc.producto_id = v.producto_id
              AND pc.categoria_id = p_categoria
              AND pc.borrado = FALSE
          ))
      AND (p_marca IS NULL OR p.marca_id = p_marca)
    ORDER BY p.destacado DESC, v.nombre ASC
    LIMIT p_limite OFFSET p_offset;
END;
$$;

-- ---------------------------------------------------------------------------
-- Ficha de producto: datos + precio efectivo + características + galería.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_producto_detalle(p_producto UUID, p_cliente UUID DEFAULT NULL)
RETURNS TABLE (
    producto_id         UUID,
    referencia          VARCHAR,
    nombre              VARCHAR,
    slug                VARCHAR,
    descripcion         TEXT,
    marca               VARCHAR,
    tipo                VARCHAR,
    categorias          TEXT[],
    etiqueta_energetica VARCHAR,
    destacado           BOOLEAN,
    precio_base         NUMERIC,
    precio_final        NUMERIC,
    descuento_pct       NUMERIC,
    descuento_origen    VARCHAR,
    moneda              CHAR,
    imagen_url          TEXT,
    plano_url           TEXT,
    caracteristicas     JSONB,
    galeria             JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cliente UUID;
BEGIN
    IF NOT (fn_es_admin() OR EXISTS (
        SELECT 1 FROM productos WHERE id = p_producto AND borrado = FALSE AND activo = TRUE
    )) THEN
        RETURN; -- sin filas: producto no publicado
    END IF;

    IF p_cliente IS NOT NULL
       AND NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente)) THEN
        RAISE EXCEPTION 'Sin permiso para consultar las condiciones de ese cliente';
    END IF;

    IF fn_es_comercial() OR fn_es_admin() THEN
        v_cliente := p_cliente;
    ELSE
        v_cliente := auth.uid();
    END IF;

    RETURN QUERY
    SELECT
        v.producto_id,
        v.referencia,
        v.nombre,
        v.slug,
        v.descripcion,
        m.nombre,
        t.nombre,
        ARRAY(
            SELECT c2.nombre
            FROM producto_categoria pc2
            JOIN categorias c2 ON c2.id = pc2.categoria_id AND c2.borrado = FALSE
            WHERE pc2.producto_id = v.producto_id AND pc2.borrado = FALSE
            ORDER BY c2.orden, c2.nombre
        ),
        v.etiqueta_energetica,
        p.destacado,
        v.precio,
        COALESCE(d.precio_final, v.precio),
        COALESCE(d.descuento_pct, 0),
        COALESCE(d.descuento_origen, 'ninguno'),
        v.moneda,
        (SELECT r.url FROM recursos r WHERE r.id = v.imagen_principal_id),
        (SELECT r.url FROM recursos r WHERE r.id = v.imagen_plano_id),
        (
            SELECT COALESCE(jsonb_agg(j), '[]'::jsonb)
            FROM (
                SELECT jsonb_build_object(
                    'clave',  c.clave,
                    'nombre', c.nombre,
                    'unidad', c.unidad,
                    'grupo',  c.grupo,
                    'orden',  c.orden,
                    'valor',  CASE c.tipo_dato
                        WHEN 'texto'    THEN to_jsonb(pcv.valor_texto)
                        WHEN 'numero'   THEN to_jsonb(pcv.valor_numero)
                        WHEN 'booleano' THEN to_jsonb(pcv.valor_booleano)
                    END
                ) AS j
                FROM producto_caracteristica pcv
                JOIN caracteristicas c ON c.id = pcv.caracteristica_id
                WHERE pcv.producto_id = v.producto_id
                  AND pcv.borrado = FALSE AND c.borrado = FALSE
                ORDER BY c.grupo, c.orden, c.nombre
            ) x
        ),
        (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'url', r.url, 'alt', r.texto_alternativo,
                    'tipo', pr.tipo_en_producto, 'orden', pr.orden
                ) ORDER BY pr.orden
            ), '[]'::jsonb)
            FROM producto_recurso pr
            JOIN recursos r ON r.id = pr.recurso_id
            WHERE pr.producto_id = v.producto_id
              AND pr.borrado = FALSE AND r.borrado = FALSE
        )
    FROM v_productos_precio_vigente v
    JOIN productos p ON p.id = v.producto_id
    LEFT JOIN marcas m ON m.id = p.marca_id
    LEFT JOIN tipos_producto t ON t.id = v.tipo_producto_id
    LEFT JOIN LATERAL fn_calcular_precio(v.producto_id, v_cliente) d ON TRUE
    WHERE v.producto_id = p_producto;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cálculo de líneas (interno de crear/editar pedido): congela precio,
-- descuento e importes. Los importes del cliente nunca se toman como válidos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calcular_lineas(p_cliente UUID, p_lineas JSONB)
RETURNS TABLE (
    producto_id         UUID,
    referencia_producto VARCHAR,
    nombre_producto     VARCHAR,
    cantidad            INT,
    precio_unitario     NUMERIC,
    descuento_pct       NUMERIC,
    descuento_origen    VARCHAR,
    descuento_importe   NUMERIC,
    iva_pct             NUMERIC,
    base                NUMERIC,
    cuota               NUMERIC,
    total               NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_pre  RECORD;
    v_iva  NUMERIC(5,2) := 0.00; -- SUPUESTO MVP: fiscal pendiente (PRD §14-4)
BEGIN
    IF p_lineas IS NULL
       OR jsonb_typeof(p_lineas) <> 'array'
       OR jsonb_array_length(p_lineas) = 0 THEN
        RAISE EXCEPTION 'El pedido necesita al menos una línea';
    END IF;

    FOR v_item IN
        SELECT * FROM jsonb_to_recordset(p_lineas) AS x(producto_id UUID, cantidad INT)
    LOOP
        IF v_item.producto_id IS NULL THEN
            RAISE EXCEPTION 'Línea sin producto';
        END IF;
        IF v_item.cantidad IS NULL OR v_item.cantidad <= 0 THEN
            RAISE EXCEPTION 'Cantidad inválida en el producto %', v_item.producto_id;
        END IF;

        SELECT * INTO v_pre FROM fn_calcular_precio(v_item.producto_id, p_cliente);

        SELECT v.referencia, v.nombre
        INTO referencia_producto, nombre_producto
        FROM v_productos_precio_vigente v
        WHERE v.producto_id = v_item.producto_id;

        producto_id := v_item.producto_id;
        cantidad := v_item.cantidad;
        precio_unitario := v_pre.precio_base;
        descuento_pct := v_pre.descuento_pct;
        descuento_origen := v_pre.descuento_origen;
        descuento_importe := round((v_pre.precio_base - v_pre.precio_final) * v_item.cantidad, 2);
        iva_pct := v_iva;
        base := round(v_pre.precio_final * v_item.cantidad, 2);
        cuota := 0;
        total := base + cuota;
        RETURN NEXT;
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Crear pedido (estado inicial: solicitado). Cliente: para sí mismo.
-- Comercial: para un cliente asignado. Admin: para cualquier cliente.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crear_pedido(
    p_cliente_id UUID DEFAULT NULL,
    p_lineas JSONB DEFAULT NULL,
    p_observaciones TEXT DEFAULT NULL
)
RETURNS TABLE (pedido_id UUID, numero_pedido BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid     UUID := auth.uid();
    v_rol     rol_usuario;
    v_cliente UUID;
    v_pedido  UUID;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Se requiere autenticación para crear pedidos';
    END IF;

    SELECT rol INTO v_rol FROM usuarios WHERE id = v_uid AND borrado = FALSE AND activo = TRUE;
    IF v_rol IS NULL THEN
        RAISE EXCEPTION 'El usuario no tiene perfil activo';
    END IF;

    IF v_rol = 'cliente' THEN
        IF p_cliente_id IS NOT NULL AND p_cliente_id <> v_uid THEN
            RAISE EXCEPTION 'Solo puedes crear pedidos propios';
        END IF;
        v_cliente := v_uid;
    ELSIF v_rol = 'comercial' THEN
        IF p_cliente_id IS NULL OR NOT fn_comercial_responsable(p_cliente_id) THEN
            RAISE EXCEPTION 'El comercial solo puede crear pedidos para clientes asignados';
        END IF;
        v_cliente := p_cliente_id;
    ELSIF v_rol = 'admin' THEN
        IF p_cliente_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM usuarios WHERE id = p_cliente_id AND rol = 'cliente' AND borrado = FALSE
        ) THEN
            RAISE EXCEPTION 'Cliente inválido para el pedido';
        END IF;
        v_cliente := p_cliente_id;
    END IF;

    PERFORM set_config('app.nota_estado', 'Pedido creado', true);

    INSERT INTO pedidos (cliente_id, creado_por, comercial_id, observaciones)
    VALUES (
        v_cliente,
        v_uid,
        (SELECT id_comercial FROM usuarios WHERE id = v_cliente),
        p_observaciones
    )
    RETURNING id INTO v_pedido;

    INSERT INTO pedido_lineas (
        pedido_id, producto_id, referencia_producto, nombre_producto, cantidad,
        precio_unitario, descuento_porcentaje, descuento_origen, descuento_importe,
        iva_porcentaje, base_imponible, cuota_iva, total_linea
    )
    SELECT v_pedido, l.* FROM fn_calcular_lineas(v_cliente, p_lineas) l;

    RETURN QUERY SELECT p.id, p.numero_pedido FROM pedidos p WHERE p.id = v_pedido;
END;
$$;

-- ---------------------------------------------------------------------------
-- Editar pedido: sustituye las líneas recalculándolas en el servidor.
-- Solo mientras el pedido está "solicitado".
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION editar_pedido(
    p_pedido UUID,
    p_lineas JSONB DEFAULT NULL,
    p_observaciones TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pedido RECORD;
    v_uid    UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Se requiere autenticación';
    END IF;

    SELECT cliente_id, estado, creado_por, comercial_id
    INTO v_pedido
    FROM pedidos WHERE id = p_pedido AND borrado = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido no encontrado';
    END IF;
    IF v_pedido.estado <> 'solicitado' THEN
        RAISE EXCEPTION 'Solo se pueden editar pedidos solicitados';
    END IF;

    IF NOT (fn_es_admin()
            OR v_pedido.cliente_id = v_uid
            OR fn_comercial_responsable(v_pedido.cliente_id)) THEN
        RAISE EXCEPTION 'Sin permiso para editar este pedido';
    END IF;

    -- Un cliente solo edita pedidos que él mismo creó.
    IF COALESCE(fn_rol_usuario(), 'cliente') = 'cliente' AND v_pedido.creado_por <> v_uid THEN
        RAISE EXCEPTION 'Sin permiso para editar este pedido';
    END IF;

    PERFORM set_config('app.nota_estado', 'Pedido editado', true);

    UPDATE pedidos
    SET observaciones = COALESCE(p_observaciones, observaciones)
    WHERE id = p_pedido;

    DELETE FROM pedido_lineas WHERE pedido_id = p_pedido; -- auditado por trigger

    INSERT INTO pedido_lineas (
        pedido_id, producto_id, referencia_producto, nombre_producto, cantidad,
        precio_unitario, descuento_porcentaje, descuento_origen, descuento_importe,
        iva_porcentaje, base_imponible, cuota_iva, total_linea
    )
    SELECT p_pedido, l.* FROM fn_calcular_lineas(v_pedido.cliente_id, p_lineas) l;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cancelar pedido (solicitado o confirmado; el trigger valida la transición).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancelar_pedido(p_pedido UUID, p_nota TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pedido RECORD;
    v_uid    UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Se requiere autenticación';
    END IF;

    SELECT cliente_id, estado, creado_por
    INTO v_pedido
    FROM pedidos WHERE id = p_pedido AND borrado = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido no encontrado';
    END IF;
    IF v_pedido.estado NOT IN ('solicitado', 'confirmado') THEN
        RAISE EXCEPTION 'El pedido en estado % no se puede cancelar', v_pedido.estado;
    END IF;

    IF NOT (fn_es_admin()
            OR v_pedido.cliente_id = v_uid
            OR fn_comercial_responsable(v_pedido.cliente_id)) THEN
        RAISE EXCEPTION 'Sin permiso para cancelar este pedido';
    END IF;

    IF COALESCE(fn_rol_usuario(), 'cliente') = 'cliente' AND v_pedido.creado_por <> v_uid THEN
        RAISE EXCEPTION 'Sin permiso para cancelar este pedido';
    END IF;

    -- PRD §8.5: el cliente solo cancela solicitudes PENDIENTES; la cancelación
    -- de pedidos confirmados queda para el comercial o el administrador.
    IF COALESCE(fn_rol_usuario(), 'cliente') = 'cliente' AND v_pedido.estado <> 'solicitado' THEN
        RAISE EXCEPTION 'El cliente solo puede cancelar solicitudes pendientes';
    END IF;

    PERFORM set_config('app.nota_estado', COALESCE(p_nota, 'Pedido cancelado'), true);
    UPDATE pedidos SET estado = 'cancelado' WHERE id = p_pedido;
END;
$$;

-- ---------------------------------------------------------------------------
-- Confirmar pedido: SOLO el comercial responsable o un admin (PRD §8.4).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirmar_pedido(p_pedido UUID, p_nota TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pedido RECORD;
    v_uid    UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Se requiere autenticación';
    END IF;

    SELECT cliente_id, estado, comercial_id
    INTO v_pedido
    FROM pedidos WHERE id = p_pedido AND borrado = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido no encontrado';
    END IF;
    IF v_pedido.estado <> 'solicitado' THEN
        RAISE EXCEPTION 'Solo se pueden confirmar pedidos solicitados';
    END IF;

    IF NOT (fn_es_admin() OR v_pedido.comercial_id = v_uid) THEN
        RAISE EXCEPTION 'Solo el comercial responsable o un administrador pueden confirmar';
    END IF;

    PERFORM set_config('app.nota_estado', COALESCE(p_nota, 'Pedido confirmado'), true);
    UPDATE pedidos SET estado = 'confirmado' WHERE id = p_pedido;
END;
$$;

-- ---------------------------------------------------------------------------
-- Avanzar estado: confirmado -> en_preparacion -> completado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION avanzar_pedido(
    p_pedido UUID,
    p_estado estado_pedido,
    p_nota TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pedido RECORD;
    v_uid    UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Se requiere autenticación';
    END IF;
    IF p_estado NOT IN ('en_preparacion', 'completado') THEN
        RAISE EXCEPTION 'Estado destino no permitido';
    END IF;

    SELECT estado, comercial_id
    INTO v_pedido
    FROM pedidos WHERE id = p_pedido AND borrado = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido no encontrado';
    END IF;

    IF NOT (fn_es_admin() OR v_pedido.comercial_id = v_uid) THEN
        RAISE EXCEPTION 'Sin permiso para cambiar el estado de este pedido';
    END IF;

    PERFORM set_config('app.nota_estado', COALESCE(p_nota, 'Cambio de estado'), true);
    UPDATE pedidos SET estado = p_estado WHERE id = p_pedido; -- el trigger valida la transición
END;
$$;

-- ---------------------------------------------------------------------------
-- Ajuste de descuento en una línea (PRD §6.5): solo comercial responsable o
-- admin, solo mientras el pedido está solicitado, con trazabilidad (el trigger
-- de auditoría guarda la fila anterior; aquí se anota el historial del pedido).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ajustar_descuento_linea(
    p_linea_id UUID,
    p_descuento_pct NUMERIC,
    p_nota TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_linea  RECORD;
    v_uid    UUID := auth.uid();
    v_nuevo_pct  NUMERIC(5,2);
    v_nuevo_base NUMERIC(14,2);
    v_nuevo_importe NUMERIC(14,2);
    v_nueva_cuota  NUMERIC(14,2);
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Se requiere autenticación';
    END IF;
    IF p_descuento_pct IS NULL OR p_descuento_pct < 0 OR p_descuento_pct > 100 THEN
        RAISE EXCEPTION 'Descuento fuera de rango';
    END IF;

    SELECT l.*, pe.estado AS pedido_estado, pe.comercial_id, pe.cliente_id
    INTO v_linea
    FROM pedido_lineas l
    JOIN pedidos pe ON pe.id = l.pedido_id
    WHERE l.id = p_linea_id AND l.borrado = FALSE AND pe.borrado = FALSE
    FOR UPDATE OF l;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Línea no encontrada';
    END IF;
    IF v_linea.pedido_estado <> 'solicitado' THEN
        RAISE EXCEPTION 'Solo se pueden ajustar descuentos mientras el pedido está solicitado';
    END IF;
    IF NOT (fn_es_admin() OR v_linea.comercial_id = v_uid) THEN
        RAISE EXCEPTION 'Solo el comercial responsable o un administrador pueden ajustar descuentos';
    END IF;

    v_nuevo_pct := round(p_descuento_pct, 2);
    v_nuevo_base := round(v_linea.precio_unitario * (1 - v_nuevo_pct / 100.0) * v_linea.cantidad, 2);
    -- Importe DEL descuento (no el importe descontado).
    v_nuevo_importe := round((v_linea.precio_unitario - v_linea.precio_unitario * (1 - v_nuevo_pct / 100.0)) * v_linea.cantidad, 2);
    v_nueva_cuota := round(v_nuevo_base * v_linea.iva_porcentaje / 100.0, 2);

    -- Anotación en el historial del pedido (el estado no cambia, por eso no
    -- salta el trigger de historial; se registra manualmente).
    INSERT INTO pedido_historial_estados (pedido_id, estado_anterior, estado_nuevo, cambiado_por, nota)
    VALUES (v_linea.pedido_id, v_linea.pedido_estado, v_linea.pedido_estado, v_uid,
            COALESCE(p_nota, 'Ajuste comercial de descuento en línea'));

    UPDATE pedido_lineas
    SET descuento_porcentaje = v_nuevo_pct,
        descuento_origen = 'ajuste_comercial',
        descuento_importe = v_nuevo_importe,
        base_imponible = v_nuevo_base,
        cuota_iva = v_nueva_cuota,
        total_linea = v_nuevo_base + v_nueva_cuota
    WHERE id = p_linea_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Gestión comercial (admin / comercial de la cartera).
-- ---------------------------------------------------------------------------

-- Asignar comercial a un cliente. Solo admin. Con trazabilidad.
CREATE OR REPLACE FUNCTION asignar_comercial(p_cliente_id UUID, p_comercial_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_antes JSONB;
BEGIN
    IF NOT fn_es_admin() THEN
        RAISE EXCEPTION 'Solo un administrador puede asignar comerciales';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = p_cliente_id AND rol = 'cliente' AND borrado = FALSE) THEN
        RAISE EXCEPTION 'Cliente inválido';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = p_comercial_id AND rol = 'comercial' AND activo = TRUE AND borrado = FALSE) THEN
        RAISE EXCEPTION 'Comercial inválido o inactivo';
    END IF;

    SELECT to_jsonb(u) INTO v_antes FROM usuarios u WHERE id = p_cliente_id;

    UPDATE usuarios SET id_comercial = p_comercial_id WHERE id = p_cliente_id;

    INSERT INTO auditoria (tabla, registro_id, accion, realizado_por, datos_anteriores, datos_nuevos)
    VALUES ('usuarios', p_cliente_id, 'asignar_comercial', auth.uid(), v_antes,
            (SELECT to_jsonb(u) FROM usuarios u WHERE id = p_cliente_id));
END;
$$;

-- Descuento general del cliente. Admin o comercial responsable. Con trazabilidad.
CREATE OR REPLACE FUNCTION asignar_descuento_cliente(p_cliente_id UUID, p_descuento_pct NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_antes JSONB;
BEGIN
    IF p_descuento_pct IS NULL OR p_descuento_pct < 0 OR p_descuento_pct > 100 THEN
        RAISE EXCEPTION 'Descuento fuera de rango';
    END IF;
    IF NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente_id)) THEN
        RAISE EXCEPTION 'Sin permiso para modificar el descuento de este cliente';
    END IF;

    SELECT to_jsonb(u) INTO v_antes FROM usuarios u WHERE id = p_cliente_id;

    UPDATE usuarios SET descuento_porcentaje = round(p_descuento_pct, 2) WHERE id = p_cliente_id;

    INSERT INTO auditoria (tabla, registro_id, accion, realizado_por, datos_anteriores, datos_nuevos)
    VALUES ('usuarios', p_cliente_id, 'asignar_descuento_cliente', auth.uid(), v_antes,
            (SELECT to_jsonb(u) FROM usuarios u WHERE id = p_cliente_id));
END;
$$;

-- Descuento específico cliente/producto (sustituye al general para ese producto).
CREATE OR REPLACE FUNCTION asignar_descuento_cliente_producto(
    p_cliente_id UUID,
    p_producto_id UUID,
    p_descuento_pct NUMERIC,
    p_fecha_fin DATE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row UUID;
BEGIN
    IF p_descuento_pct IS NULL OR p_descuento_pct < 0 OR p_descuento_pct > 100 THEN
        RAISE EXCEPTION 'Descuento fuera de rango';
    END IF;
    IF NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente_id)) THEN
        RAISE EXCEPTION 'Sin permiso para modificar descuentos de este cliente';
    END IF;
    IF p_fecha_fin IS NOT NULL AND p_fecha_fin <= fn_hoy() THEN
        RAISE EXCEPTION 'La fecha de fin debe ser futura';
    END IF;

    INSERT INTO descuentos_cliente_producto (cliente_id, producto_id, descuento_porcentaje, fecha_fin, creado_por)
    VALUES (p_cliente_id, p_producto_id, round(p_descuento_pct, 2), p_fecha_fin, auth.uid())
    RETURNING id INTO v_row;

    INSERT INTO auditoria (tabla, registro_id, accion, realizado_por, datos_anteriores, datos_nuevos)
    VALUES ('descuentos_cliente_producto', v_row, 'INSERT', auth.uid(), NULL,
            (SELECT to_jsonb(d) FROM descuentos_cliente_producto d WHERE id = v_row));
END;
$$;

-- Anular (borrado lógico) un descuento específico vigente.
CREATE OR REPLACE FUNCTION anular_descuento_cliente_producto(
    p_cliente_id UUID,
    p_producto_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT (fn_es_admin() OR fn_comercial_responsable(p_cliente_id)) THEN
        RAISE EXCEPTION 'Sin permiso para modificar descuentos de este cliente';
    END IF;

    UPDATE descuentos_cliente_producto
    SET borrado = TRUE, deleted_at = now(), deleted_by = auth.uid()
    WHERE cliente_id = p_cliente_id
      AND producto_id = p_producto_id
      AND borrado = FALSE;
END;
$$;
