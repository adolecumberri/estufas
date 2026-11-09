-- ============================================================================
-- 0028: fn_pedido_historial — historial de estados con el NOMBRE y ROL del
-- actor de cada cambio (decisión del usuario 10/11/2026: el admin opera
-- pedidos y TODA operación debe quedar atribuida a quien la hizo).
--
-- El trigger fn_pedido_registrar_historial (0001) ya guarda
-- cambiado_por = fn_app_user_id() en cada inserción y en cada cambio de
-- estado (confirmar/cancelar/avanzar, incluido el admin); este RPC expone
-- nombre y rol del actor sin dar acceso a la tabla usuarios (RLS) y con el
-- mismo alcance que fn_pedido_detalle: el cliente ve su pedido, el comercial
-- los de su cartera y el admin todos.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_pedido_historial(p_pedido UUID)
RETURNS TABLE (
    id              UUID,
    pedido_id       UUID,
    estado_anterior estado_pedido,
    estado_nuevo    estado_pedido,
    cambiado_por    UUID,
    actor_nombre    VARCHAR,
    actor_rol       rol_usuario,
    fecha_cambio    TIMESTAMPTZ,
    nota            TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT h.id,
           h.pedido_id,
           h.estado_anterior,
           h.estado_nuevo,
           h.cambiado_por,
           u.nombre,
           u.rol,
           h.fecha_cambio,
           h.nota
    FROM pedido_historial_estados h
    JOIN pedidos pe ON pe.id = h.pedido_id AND pe.borrado = FALSE
    LEFT JOIN usuarios u ON u.id = h.cambiado_por
    WHERE h.pedido_id = p_pedido
      AND (fn_es_admin()
           OR pe.cliente_id = auth.uid()
           OR fn_comercial_responsable(pe.cliente_id))
    ORDER BY h.fecha_cambio DESC, h.id DESC;
$$;

GRANT EXECUTE ON FUNCTION fn_pedido_historial(UUID) TO authenticated;
