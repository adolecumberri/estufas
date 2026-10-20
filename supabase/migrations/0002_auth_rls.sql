-- ============================================================================
-- 0002: Integración con Supabase Auth + Row Level Security
--
-- Modelo de autorización (PRD §3 y §10.3: los permisos se comprueban en el
-- backend; RLS es la frontera de seguridad):
--   * anon          → catálogo publicado y precios públicos. Nada más.
--   * cliente       → sus datos, sus pedidos, precios efectivos (vía RPC).
--   * comercial     → clientes asignados, sus pedidos y condiciones; confirma
--                     pedidos y ajusta descuentos (vía RPC).
--   * admin         → todo.
--   * Todas las escrituras comerciales se hacen a través de funciones RPC
--     (0003), nunca con DML directo del cliente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers de rol (SECURITY DEFINER: las políticas y RPCs pueden consultarlos
-- sin exponer las tablas).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_rol_usuario()
RETURNS rol_usuario
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT rol FROM usuarios
    WHERE id = auth.uid() AND borrado = FALSE AND activo = TRUE;
$$;

CREATE OR REPLACE FUNCTION fn_es_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(fn_rol_usuario() = 'admin', FALSE);
$$;

CREATE OR REPLACE FUNCTION fn_es_comercial()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(fn_rol_usuario() = 'comercial', FALSE);
$$;

-- ¿El usuario autenticado es el comercial responsable del cliente indicado?
CREATE OR REPLACE FUNCTION fn_comercial_responsable(p_cliente UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = p_cliente
          AND id_comercial = auth.uid()
          AND rol = 'cliente'
          AND borrado = FALSE
    );
$$;

-- ---------------------------------------------------------------------------
-- Creación automática del perfil de negocio al registrarse en GoTrue.
-- El rol, el tipo de cliente y los datos fiscales llegan en user_metadata
-- (validados también en la UI de registro; este CHECK es el respaldo).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rol  rol_usuario;
    v_tipo tipo_cliente;
BEGIN
    v_rol  := COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'rol', ''), 'cliente');
    IF v_rol NOT IN ('cliente', 'comercial', 'admin') THEN
        v_rol := 'cliente';
    END IF;

    v_tipo := NULLIF(NEW.raw_user_meta_data ->> 'tipo_cliente', '');
    IF v_rol = 'cliente' AND v_tipo IS NULL THEN
        v_tipo := 'particular';
    END IF;

    INSERT INTO usuarios (
        id, nombre, apellidos, email, telefono, rol, tipo_cliente,
        razon_social, nif_cif, pais_facturacion
    ) VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'nombre', ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
        NULLIF(NEW.raw_user_meta_data ->> 'apellidos', ''),
        COALESCE(NEW.email, ''),
        NULLIF(NEW.raw_user_meta_data ->> 'telefono', ''),
        v_rol,
        v_tipo,
        NULLIF(NEW.raw_user_meta_data ->> 'razon_social', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'nif_cif', ''),
        COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'pais_facturacion', ''), 'ES')
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_new_user
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();

-- ---------------------------------------------------------------------------
-- Protección de campos sensibles de usuarios.
-- Solo el administrador (o el backend vía RPC, que ejecuta como postgres tras
-- validar) puede cambiar rol, asignación comercial, descuentos o estado.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_usuarios_proteger_campos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_user IN ('postgres', 'service_role') OR fn_es_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.rol IS DISTINCT FROM OLD.rol
    OR NEW.id_comercial IS DISTINCT FROM OLD.id_comercial
    OR NEW.descuento_porcentaje IS DISTINCT FROM OLD.descuento_porcentaje
    OR NEW.activo IS DISTINCT FROM OLD.activo
    OR NEW.borrado IS DISTINCT FROM OLD.borrado
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by THEN
        RAISE EXCEPTION 'Solo un administrador puede modificar rol, asignación comercial, descuentos o estado del usuario';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_proteger_campos
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION fn_usuarios_proteger_campos();

-- ---------------------------------------------------------------------------
-- RLS en todas las tablas.
-- ---------------------------------------------------------------------------

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE caracteristicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_caracteristica ENABLE ROW LEVEL SECURITY;
ALTER TABLE caracteristica_tipo_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_recurso ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE descuentos_cliente_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE promociones_tienda ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_historial_estados ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Usuarios: cada uno ve su fila; el comercial ve sus clientes asignados;
-- el admin ve todo. El perfil se crea solo con el trigger (sin INSERT directo).
-- ---------------------------------------------------------------------------

CREATE POLICY pol_usuarios_select ON usuarios
    FOR SELECT
    USING (
        fn_es_admin()
        OR id = auth.uid()
        OR (fn_es_comercial() AND id_comercial = auth.uid())
    );

CREATE POLICY pol_usuarios_update ON usuarios
    FOR UPDATE
    USING (fn_es_admin() OR id = auth.uid())
    WITH CHECK (fn_es_admin() OR id = auth.uid());

REVOKE INSERT ON usuarios FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Catálogo: lectura pública solo de lo publicado; escritura solo admin.
-- Nota: las tablas de relación "cuelgan" del estado de publicación del
-- producto para no filtrar información de productos no publicados.
-- ---------------------------------------------------------------------------

CREATE POLICY pol_productos_select ON productos
    FOR SELECT
    USING (borrado = FALSE AND (activo = TRUE OR fn_es_admin()));

CREATE POLICY pol_productos_insert ON productos
    FOR INSERT WITH CHECK (fn_es_admin());

CREATE POLICY pol_productos_update ON productos
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

CREATE POLICY pol_marcas_select ON marcas
    FOR SELECT
    USING (borrado = FALSE AND (activo = TRUE OR fn_es_admin()));

CREATE POLICY pol_marcas_insert ON marcas
    FOR INSERT WITH CHECK (fn_es_admin());

CREATE POLICY pol_marcas_update ON marcas
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

CREATE POLICY pol_tipos_select ON tipos_producto
    FOR SELECT
    USING (borrado = FALSE AND (activo = TRUE OR fn_es_admin()));

CREATE POLICY pol_tipos_insert ON tipos_producto
    FOR INSERT WITH CHECK (fn_es_admin());

CREATE POLICY pol_tipos_update ON tipos_producto
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

CREATE POLICY pol_categorias_select ON categorias
    FOR SELECT
    USING (borrado = FALSE AND (activo = TRUE OR fn_es_admin()));

CREATE POLICY pol_categorias_insert ON categorias
    FOR INSERT WITH CHECK (fn_es_admin());

CREATE POLICY pol_categorias_update ON categorias
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

CREATE POLICY pol_caracteristicas_select ON caracteristicas
    FOR SELECT
    USING (borrado = FALSE AND (activo = TRUE OR fn_es_admin()));

CREATE POLICY pol_caracteristicas_insert ON caracteristicas
    FOR INSERT WITH CHECK (fn_es_admin());

CREATE POLICY pol_caracteristicas_update ON caracteristicas
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

CREATE POLICY pol_caracteristica_tipo_select ON caracteristica_tipo_producto
    FOR SELECT
    USING (borrado = FALSE);

CREATE POLICY pol_caracteristica_tipo_insert ON caracteristica_tipo_producto
    FOR INSERT WITH CHECK (fn_es_admin());

CREATE POLICY pol_caracteristica_tipo_update ON caracteristica_tipo_producto
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

CREATE POLICY pol_producto_categoria_select ON producto_categoria
    FOR SELECT
    USING (
        borrado = FALSE
        AND (fn_es_admin() OR EXISTS (
            SELECT 1 FROM productos p
            WHERE p.id = producto_id AND p.borrado = FALSE AND p.activo = TRUE
        ))
    );

CREATE POLICY pol_producto_categoria_insert ON producto_categoria
    FOR INSERT WITH CHECK (fn_es_admin());

CREATE POLICY pol_producto_categoria_update ON producto_categoria
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

CREATE POLICY pol_producto_caracteristica_select ON producto_caracteristica
    FOR SELECT
    USING (
        borrado = FALSE
        AND (fn_es_admin() OR EXISTS (
            SELECT 1 FROM productos p
            WHERE p.id = producto_id AND p.borrado = FALSE AND p.activo = TRUE
        ))
    );

CREATE POLICY pol_producto_caracteristica_insert ON producto_caracteristica
    FOR INSERT WITH CHECK (fn_es_admin());

CREATE POLICY pol_producto_caracteristica_update ON producto_caracteristica
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

CREATE POLICY pol_producto_recurso_select ON producto_recurso
    FOR SELECT
    USING (
        borrado = FALSE
        AND (fn_es_admin() OR EXISTS (
            SELECT 1 FROM productos p
            WHERE p.id = producto_id AND p.borrado = FALSE AND p.activo = TRUE
        ))
    );

CREATE POLICY pol_producto_recurso_insert ON producto_recurso
    FOR INSERT WITH CHECK (fn_es_admin());

CREATE POLICY pol_producto_recurso_update ON producto_recurso
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

-- Recursos: públicos si están activos y (son iconos o pertenecen a un producto
-- publicado). Los recursos privados/inactivos solo los ve el admin.
CREATE POLICY pol_recursos_select ON recursos
    FOR SELECT
    USING (
        borrado = FALSE
        AND (fn_es_admin()
            OR (activo = TRUE AND (
                tipo = 'icono_svg'
                OR EXISTS (
                    SELECT 1 FROM productos p
                    WHERE p.borrado = FALSE AND p.activo = TRUE
                      AND (p.imagen_principal_id = recursos.id OR p.imagen_plano_id = recursos.id)
                )
                OR EXISTS (
                    SELECT 1 FROM producto_recurso pr
                    JOIN productos p ON p.id = pr.producto_id
                    WHERE pr.recurso_id = recursos.id AND pr.borrado = FALSE
                      AND p.borrado = FALSE AND p.activo = TRUE
                )
                OR EXISTS (
                    SELECT 1 FROM caracteristicas c
                    WHERE c.icono_recurso_id = recursos.id
                      AND c.borrado = FALSE AND c.activo = TRUE
                )
            ))
        )
    );

CREATE POLICY pol_recursos_insert ON recursos
    FOR INSERT WITH CHECK (fn_es_admin());

CREATE POLICY pol_recursos_update ON recursos
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

-- ---------------------------------------------------------------------------
-- Precios: el público ve el periodo vigente; el admin ve el histórico.
-- Solo el admin escribe (el RPC de pedidos calcula, no escribe precios).
-- ---------------------------------------------------------------------------

CREATE POLICY pol_precios_select ON producto_precios
    FOR SELECT
    USING (
        borrado = FALSE
        AND (
            fn_es_admin()
            OR (fecha_inicio <= fn_hoy() AND (fecha_fin IS NULL OR fecha_fin > fn_hoy()))
        )
    );

CREATE POLICY pol_precios_insert ON producto_precios
    FOR INSERT WITH CHECK (fn_es_admin());

CREATE POLICY pol_precios_update ON producto_precios
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

-- ---------------------------------------------------------------------------
-- Descuentos por cliente/producto: cliente ve los suyos; comercial los de sus
-- clientes; admin todos. Escribe el admin o el comercial responsable.
-- ---------------------------------------------------------------------------

CREATE POLICY pol_descuentos_select ON descuentos_cliente_producto
    FOR SELECT
    USING (
        borrado = FALSE
        AND (
            fn_es_admin()
            OR cliente_id = auth.uid()
            OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id))
        )
    );

CREATE POLICY pol_descuentos_insert ON descuentos_cliente_producto
    FOR INSERT
    WITH CHECK (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)));

CREATE POLICY pol_descuentos_update ON descuentos_cliente_producto
    FOR UPDATE
    USING (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)))
    WITH CHECK (fn_es_admin() OR (fn_es_comercial() AND fn_comercial_responsable(cliente_id)));

-- ---------------------------------------------------------------------------
-- Promociones de tienda: visibles para usuarios autenticados; escribe el admin.
-- ---------------------------------------------------------------------------

CREATE POLICY pol_promociones_select ON promociones_tienda
    FOR SELECT
    USING (borrado = FALSE AND (fn_es_admin() OR auth.uid() IS NOT NULL));

CREATE POLICY pol_promociones_insert ON promociones_tienda
    FOR INSERT WITH CHECK (fn_es_admin());

CREATE POLICY pol_promociones_update ON promociones_tienda
    FOR UPDATE
    USING (fn_es_admin())
    WITH CHECK (fn_es_admin());

-- ---------------------------------------------------------------------------
-- Pedidos y líneas: el cliente ve los suyos, el comercial los de su cartera,
-- el admin todos. NO hay DML directo para la aplicación: crear/editar/
-- cancelar/confirmar se hace con los RPC de 0003 (transaccionales y auditados).
-- ---------------------------------------------------------------------------

CREATE POLICY pol_pedidos_select ON pedidos
    FOR SELECT
    USING (
        borrado = FALSE
        AND (
            fn_es_admin()
            OR cliente_id = auth.uid()
            OR (fn_es_comercial() AND comercial_id = auth.uid())
        )
    );

CREATE POLICY pol_pedido_lineas_select ON pedido_lineas
    FOR SELECT
    USING (
        borrado = FALSE
        AND (
            fn_es_admin()
            OR pedido_id IN (SELECT id FROM pedidos WHERE cliente_id = auth.uid())
            OR (fn_es_comercial() AND pedido_id IN (SELECT id FROM pedidos WHERE comercial_id = auth.uid()))
        )
    );

-- Historial de estados: misma visibilidad que el pedido.
CREATE POLICY pol_pedido_historial_select ON pedido_historial_estados
    FOR SELECT
    USING (
        fn_es_admin()
        OR pedido_id IN (SELECT id FROM pedidos WHERE cliente_id = auth.uid())
        OR (fn_es_comercial() AND pedido_id IN (SELECT id FROM pedidos WHERE comercial_id = auth.uid()))
    );

-- ---------------------------------------------------------------------------
-- Auditoría: solo lectura para admin. Solo inserción (triggers/RPC).
-- ---------------------------------------------------------------------------

CREATE POLICY pol_auditoria_select ON auditoria
    FOR SELECT
    USING (fn_es_admin());

REVOKE INSERT, UPDATE, DELETE ON auditoria FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON pedido_historial_estados FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vistas: v_productos_precio_vigente es pública (solo precios públicos).
-- Las vistas de descuentos y promociones NO se exponen al cliente: las usan
-- los RPC con SECURITY DEFINER.
-- ---------------------------------------------------------------------------

GRANT SELECT ON v_productos_precio_vigente TO anon, authenticated;
REVOKE ALL ON v_descuentos_cliente_producto_vigentes FROM anon, authenticated;
REVOKE ALL ON v_promociones_tienda_vigentes FROM anon, authenticated;
