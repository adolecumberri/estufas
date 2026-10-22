-- ============================================================================
-- 0010: El registro público SIEMPRE crea clientes (fix de seguridad)
--
-- CodeRabbit (revisión completa PR #4, alta): fn_handle_new_user (0002)
-- aceptaba el rol desde raw_user_meta_data, que controla el propio
-- registrante: cualquiera podía auto-provisionarse 'admin' o 'comercial'
-- en el registro público (escalada de privilegios local).
-- Aquí se recrea el trigger fijando SIEMPRE v_rol := 'cliente': los perfiles
-- admin/comercial solo se provisionan por seed o por flujo de administración,
-- nunca por registro público.
-- ============================================================================

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
    -- El rol NO se toma de los metadatos del registrante (escalada de
    -- privilegios): el registro público siempre crea clientes.
    v_rol := 'cliente';

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
