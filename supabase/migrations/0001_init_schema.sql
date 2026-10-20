-- ============================================================================
-- 0001: Esquema base — catálogo, clientes, comerciales, descuentos y pedidos
-- Adaptación para Supabase de docs/schema05.sql (v0.5).
--
-- Cambios respecto al original:
--   * Sin BEGIN/COMMIT: Supabase ejecuta cada migración en una transacción.
--   * usuarios.id referencia auth.users(id); eliminado password_hash (GoTrue
--     gestiona credenciales). El trigger que crea la fila de usuarios está en
--     la migración 0002 (depende de auth y de las políticas).
--   * fn_app_user_id() ahora devuelve auth.uid() (JWT de Supabase) en lugar de
--     leer el GUC app.user_id. El resto del código (historial, auditoría) no
--     cambia.
--
-- Convenciones (heredadas del original):
--   * borrado lógico: borrado, deleted_at, deleted_by
--   * precios NUMERIC, nunca FLOAT
--   * precios del catálogo SIN IVA; el IVA se aplica en la línea del pedido
--   * importes/precios históricos copiados a las líneas del pedido
--   * fecha_fin es EXCLUSIVA: un precio deja de aplicarse en esa fecha
--   * "hoy" se calcula en Europe/Madrid (fn_hoy)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Funciones auxiliares genéricas
-- ---------------------------------------------------------------------------

-- Fecha de negocio. Evita depender de la zona horaria del servidor o de la sesión.
CREATE OR REPLACE FUNCTION fn_hoy()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
    SELECT (now() AT TIME ZONE 'Europe/Madrid')::date;
$$;

-- Usuario autenticado. En Supabase, la identidad viaja en el JWT y se expone
-- con auth.uid(). El nombre se conserva para no tocar el resto del esquema.
CREATE OR REPLACE FUNCTION fn_app_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT auth.uid();
$$;

-- Mantiene updated_at en cada UPDATE.
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- Bloquea UPDATE/DELETE/TRUNCATE en tablas de solo inserción.
CREATE OR REPLACE FUNCTION fn_bloquear_modificacion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % es de solo inserción (operación % no permitida)', TG_TABLE_NAME, TG_OP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

CREATE TYPE rol_usuario AS ENUM ('cliente', 'comercial', 'admin');
CREATE TYPE tipo_dato_caracteristica AS ENUM ('texto', 'numero', 'booleano');
CREATE TYPE tipo_recurso AS ENUM ('imagen', 'plano', 'ficha_tecnica', 'icono_svg', 'documento', 'video', 'otro');
CREATE TYPE estado_pedido AS ENUM (
    'solicitado',
    'confirmado',
    'en_preparacion',
    'completado',
    'cancelado'
);
CREATE TYPE tipo_cliente AS ENUM ('particular', 'empresa');

-- ---------------------------------------------------------------------------
-- Usuarios: perfil de negocio asociado a la identidad de auth.users.
-- Clientes, comerciales y administradores.
-- ---------------------------------------------------------------------------
CREATE TABLE usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    nombre VARCHAR(120) NOT NULL,
    apellidos VARCHAR(160),
    email VARCHAR(320) NOT NULL,
    telefono VARCHAR(40),
    rol rol_usuario NOT NULL DEFAULT 'cliente',
    tipo_cliente tipo_cliente,
    razon_social VARCHAR(240),
    nif_cif VARCHAR(30),
    direccion_facturacion VARCHAR(240),
    codigo_postal_facturacion VARCHAR(20),
    ciudad_facturacion VARCHAR(120),
    provincia_facturacion VARCHAR(120),
    pais_facturacion CHAR(2) NOT NULL DEFAULT 'ES',
    id_comercial UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    descuento_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0.00
        CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_usuario_comercial
        CHECK (
            (rol = 'cliente' AND (id_comercial IS NULL OR id_comercial <> id))
            OR (rol IN ('comercial', 'admin') AND id_comercial IS NULL)
        ),
    CONSTRAINT chk_usuario_tipo_cliente
        CHECK (
            (rol = 'cliente' AND tipo_cliente IS NOT NULL)
            OR (rol IN ('comercial', 'admin') AND tipo_cliente IS NULL)
        ),
    -- Solo un cliente con comercial asignado puede tener descuento individual.
    CONSTRAINT chk_usuario_descuento
        CHECK (descuento_porcentaje = 0 OR (rol = 'cliente' AND id_comercial IS NOT NULL)),
    -- Las empresas necesitan razón social y NIF/CIF.
    CONSTRAINT chk_usuario_empresa_datos_fiscales
        CHECK (
            tipo_cliente IS DISTINCT FROM 'empresa'
            OR (NULLIF(btrim(razon_social), '') IS NOT NULL AND NULLIF(btrim(nif_cif), '') IS NOT NULL)
        ),
    CONSTRAINT chk_usuario_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_usuarios_email_activo
    ON usuarios (lower(email))
    WHERE borrado = FALSE;
CREATE INDEX ix_usuarios_comercial
    ON usuarios (id_comercial)
    WHERE borrado = FALSE;
CREATE INDEX ix_usuarios_rol_activo
    ON usuarios (rol, activo)
    WHERE borrado = FALSE;

-- Valida que id_comercial apunte a un comercial activo y protege a los comerciales con clientes.
CREATE OR REPLACE FUNCTION fn_usuario_validar_comercial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.id_comercial IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.id_comercial IS DISTINCT FROM OLD.id_comercial) THEN
        IF NOT EXISTS (
            SELECT 1 FROM usuarios
            WHERE id = NEW.id_comercial
              AND rol = 'comercial'
              AND activo = TRUE
              AND borrado = FALSE
        ) THEN
            RAISE EXCEPTION 'id_comercial % no corresponde a un comercial activo', NEW.id_comercial;
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.rol = 'comercial'
       AND (NEW.rol <> 'comercial' OR (NEW.borrado AND NOT OLD.borrado)) THEN
        IF EXISTS (
            SELECT 1 FROM usuarios
            WHERE id_comercial = OLD.id AND borrado = FALSE
        ) THEN
            RAISE EXCEPTION 'El comercial % tiene clientes asignados; reasígnalos antes de cambiar su rol o borrarlo', OLD.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_validar_comercial
BEFORE INSERT OR UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION fn_usuario_validar_comercial();

-- ---------------------------------------------------------------------------
-- Marcas y tipos genéricos de producto.
-- ---------------------------------------------------------------------------
CREATE TABLE marcas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(160) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_marcas_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_marcas_nombre_activo ON marcas (lower(nombre)) WHERE borrado = FALSE;

CREATE TABLE tipos_producto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    clave VARCHAR(80) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_tipos_producto_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_tipos_producto_clave_activo ON tipos_producto (clave) WHERE borrado = FALSE;

-- ---------------------------------------------------------------------------
-- Recursos digitales: las URLs/rutas apuntan al almacenamiento de archivos.
-- ---------------------------------------------------------------------------
CREATE TABLE recursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    tipo tipo_recurso NOT NULL,
    url TEXT NOT NULL,
    texto_alternativo VARCHAR(255),
    mime_type VARCHAR(120),
    tamano_bytes BIGINT CHECK (tamano_bytes IS NULL OR tamano_bytes >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_recursos_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE INDEX ix_recursos_tipo ON recursos (tipo) WHERE borrado = FALSE;

-- ---------------------------------------------------------------------------
-- Catálogo central: estufas, velas, cerillas, accesorios, jardín, etc.
-- SUPUESTO MVP: "activo = TRUE" es el estado "publicado" (el PRD menciona un
-- estado de publicación; el esquema v0.5 no tiene columna propia para ello).
-- ---------------------------------------------------------------------------
CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referencia VARCHAR(100) NOT NULL,
    nombre VARCHAR(240) NOT NULL,
    slug VARCHAR(260),
    descripcion TEXT,
    tipo_producto_id UUID NOT NULL REFERENCES tipos_producto(id) ON DELETE RESTRICT,
    marca_id UUID REFERENCES marcas(id) ON DELETE RESTRICT,
    -- Se admite A+++ ... G porque algunas familias (p. ej. calefactores locales) usan escalas
    -- con "+". Ajustar a las escalas reales de los productos del catálogo.
    etiqueta_energetica VARCHAR(20)
        CHECK (etiqueta_energetica IS NULL OR etiqueta_energetica ~ '^(A\+{0,3}|[B-G])$'),
    imagen_principal_id UUID REFERENCES recursos(id) ON DELETE RESTRICT,
    imagen_plano_id UUID REFERENCES recursos(id) ON DELETE RESTRICT,
    destacado BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_productos_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_productos_referencia_activa ON productos (lower(referencia)) WHERE borrado = FALSE;
CREATE UNIQUE INDEX uq_productos_slug_activo ON productos (slug) WHERE slug IS NOT NULL AND borrado = FALSE;
CREATE INDEX ix_productos_tipo ON productos (tipo_producto_id) WHERE borrado = FALSE AND activo = TRUE;
CREATE INDEX ix_productos_marca ON productos (marca_id) WHERE borrado = FALSE AND activo = TRUE;
CREATE INDEX ix_productos_nombre_trgm
    ON productos USING gin (lower(nombre) gin_trgm_ops)
    WHERE borrado = FALSE AND activo = TRUE;

-- Comprueba que la imagen principal sea una imagen y el plano sea un plano (o imagen).
CREATE OR REPLACE FUNCTION fn_producto_validar_recursos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.imagen_principal_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM recursos WHERE id = NEW.imagen_principal_id AND tipo = 'imagen') THEN
            RAISE EXCEPTION 'imagen_principal_id debe apuntar a un recurso de tipo imagen';
        END IF;
    END IF;
    IF NEW.imagen_plano_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM recursos WHERE id = NEW.imagen_plano_id AND tipo IN ('plano', 'imagen')) THEN
            RAISE EXCEPTION 'imagen_plano_id debe apuntar a un recurso de tipo plano o imagen';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_productos_validar_recursos
BEFORE INSERT OR UPDATE OF imagen_principal_id, imagen_plano_id ON productos
FOR EACH ROW EXECUTE FUNCTION fn_producto_validar_recursos();

-- ---------------------------------------------------------------------------
-- Categorías flexibles agrupadas por dimensión: combustible, instalación, construcción, etc.
-- ---------------------------------------------------------------------------
CREATE TABLE categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(120) NOT NULL,
    clave VARCHAR(100) NOT NULL,
    grupo VARCHAR(100) NOT NULL,
    descripcion TEXT,
    orden INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_categorias_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_categorias_clave_activa ON categorias (clave) WHERE borrado = FALSE;
CREATE INDEX ix_categorias_grupo ON categorias (grupo, orden) WHERE borrado = FALSE AND activo = TRUE;

CREATE TABLE producto_categoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_producto_categoria_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_producto_categoria_activa
    ON producto_categoria (producto_id, categoria_id) WHERE borrado = FALSE;
CREATE INDEX ix_producto_categoria_categoria ON producto_categoria (categoria_id) WHERE borrado = FALSE;

-- ---------------------------------------------------------------------------
-- Diccionario de características: técnicas (potencia, peso...) y prestaciones (autolimpieza...).
-- ---------------------------------------------------------------------------
CREATE TABLE caracteristicas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(180) NOT NULL,
    clave VARCHAR(140) NOT NULL,
    tipo_dato tipo_dato_caracteristica NOT NULL,
    unidad VARCHAR(40),
    grupo VARCHAR(100) NOT NULL DEFAULT 'Datos técnicos',
    descripcion TEXT,
    icono_recurso_id UUID REFERENCES recursos(id) ON DELETE RESTRICT,
    orden INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_caracteristicas_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_caracteristicas_clave_activa ON caracteristicas (clave) WHERE borrado = FALSE;
CREATE INDEX ix_caracteristicas_grupo ON caracteristicas (grupo, orden) WHERE borrado = FALSE AND activo = TRUE;

CREATE TABLE producto_caracteristica (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    caracteristica_id UUID NOT NULL REFERENCES caracteristicas(id) ON DELETE RESTRICT,
    valor_texto TEXT,
    valor_numero NUMERIC(14,4),
    valor_booleano BOOLEAN,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_producto_caracteristica_un_valor
        CHECK (num_nonnulls(valor_texto, valor_numero, valor_booleano) = 1),
    CONSTRAINT chk_producto_caracteristica_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_producto_caracteristica_activa
    ON producto_caracteristica (producto_id, caracteristica_id) WHERE borrado = FALSE;
CREATE INDEX ix_producto_caracteristica_caracteristica
    ON producto_caracteristica (caracteristica_id) WHERE borrado = FALSE;
CREATE INDEX ix_producto_caracteristica_producto
    ON producto_caracteristica (producto_id) WHERE borrado = FALSE;

-- El valor guardado debe corresponder al tipo_dato declarado en el diccionario.
CREATE OR REPLACE FUNCTION fn_producto_caracteristica_validar_tipo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tipo tipo_dato_caracteristica;
BEGIN
    SELECT tipo_dato INTO v_tipo FROM caracteristicas WHERE id = NEW.caracteristica_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe la característica %', NEW.caracteristica_id;
    END IF;

    IF (v_tipo = 'texto'    AND NEW.valor_texto    IS NULL)
    OR (v_tipo = 'numero'   AND NEW.valor_numero   IS NULL)
    OR (v_tipo = 'booleano' AND NEW.valor_booleano IS NULL) THEN
        RAISE EXCEPTION 'La característica % es de tipo % y el valor informado no coincide',
            NEW.caracteristica_id, v_tipo;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_producto_caracteristica_validar_tipo
BEFORE INSERT OR UPDATE ON producto_caracteristica
FOR EACH ROW EXECUTE FUNCTION fn_producto_caracteristica_validar_tipo();

-- No permitir cambiar tipo_dato de una característica que ya tiene valores.
CREATE OR REPLACE FUNCTION fn_caracteristica_proteger_tipo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.tipo_dato IS DISTINCT FROM OLD.tipo_dato
       AND EXISTS (
            SELECT 1 FROM producto_caracteristica
            WHERE caracteristica_id = OLD.id AND borrado = FALSE
       ) THEN
        RAISE EXCEPTION 'No se puede cambiar tipo_dato de la característica % porque ya tiene valores', OLD.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_caracteristicas_proteger_tipo
BEFORE UPDATE OF tipo_dato ON caracteristicas
FOR EACH ROW EXECUTE FUNCTION fn_caracteristica_proteger_tipo();

-- Qué características aplican a qué tipos de producto/categorías (opcional para el MVP).
CREATE TABLE caracteristica_tipo_producto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caracteristica_id UUID NOT NULL REFERENCES caracteristicas(id) ON DELETE RESTRICT,
    tipo_producto_id UUID NOT NULL REFERENCES tipos_producto(id) ON DELETE RESTRICT,
    obligatoria BOOLEAN NOT NULL DEFAULT FALSE,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_caracteristica_tipo_producto_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_caracteristica_tipo_producto_activa
    ON caracteristica_tipo_producto (caracteristica_id, tipo_producto_id) WHERE borrado = FALSE;

-- ---------------------------------------------------------------------------
-- Galería y documentos por producto.
-- ---------------------------------------------------------------------------
CREATE TABLE producto_recurso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    recurso_id UUID NOT NULL REFERENCES recursos(id) ON DELETE RESTRICT,
    tipo_en_producto VARCHAR(50) NOT NULL DEFAULT 'galeria'
        CHECK (tipo_en_producto IN ('galeria', 'principal', 'plano', 'ficha_tecnica', 'documento', 'video', 'otro')),
    orden INTEGER NOT NULL DEFAULT 0,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_producto_recurso_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_producto_recurso_activo
    ON producto_recurso (producto_id, recurso_id, tipo_en_producto) WHERE borrado = FALSE;
CREATE INDEX ix_producto_recurso_producto ON producto_recurso (producto_id, orden) WHERE borrado = FALSE;

-- ---------------------------------------------------------------------------
-- Histórico de precios comunes del catálogo (SIN IVA).
-- ---------------------------------------------------------------------------
CREATE TABLE producto_precios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    precio NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
    -- Solo EUR por ahora. Para multimoneda, eliminar este CHECK y modelar el cambio.
    moneda CHAR(3) NOT NULL DEFAULT 'EUR' CHECK (moneda = 'EUR'),
    fecha_inicio DATE NOT NULL DEFAULT fn_hoy(),
    fecha_fin DATE,
    creado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_precio_fechas CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio),
    CONSTRAINT chk_producto_precios_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL)),
    CONSTRAINT ex_producto_precios_periodos
        EXCLUDE USING gist (
            producto_id WITH =,
            daterange(fecha_inicio, fecha_fin, '[)') WITH &&
        ) WHERE (borrado = FALSE)
);
CREATE INDEX ix_producto_precios_producto_fecha
    ON producto_precios (producto_id, fecha_inicio DESC) WHERE borrado = FALSE;
COMMENT ON COLUMN producto_precios.precio IS 'Precio de catálogo SIN IVA.';

-- ---------------------------------------------------------------------------
-- Descuentos excepcionales por producto para un cliente.
-- Una fila con descuento 0 es válida y SUSTITUYE al descuento general del cliente
-- para ese producto (es la forma de excluir un producto del descuento general).
-- ---------------------------------------------------------------------------
CREATE TABLE descuentos_cliente_producto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    descuento_porcentaje NUMERIC(5,2) NOT NULL
        CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
    fecha_inicio DATE NOT NULL DEFAULT fn_hoy(),
    fecha_fin DATE,
    creado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_descuento_producto_fechas CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio),
    CONSTRAINT chk_descuento_cliente_producto_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL)),
    CONSTRAINT ex_descuento_cliente_producto_periodos
        EXCLUDE USING gist (
            cliente_id WITH =,
            producto_id WITH =,
            daterange(fecha_inicio, fecha_fin, '[)') WITH &&
        ) WHERE (borrado = FALSE)
);
CREATE INDEX ix_descuentos_cliente_producto_cliente
    ON descuentos_cliente_producto (cliente_id, producto_id) WHERE borrado = FALSE;

-- El destinatario debe ser un cliente con comercial asignado (los clientes sin comercial
-- solo pueden beneficiarse de promociones de tienda).
CREATE OR REPLACE FUNCTION fn_descuento_cliente_validar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = NEW.cliente_id
          AND rol = 'cliente'
          AND id_comercial IS NOT NULL
          AND borrado = FALSE
    ) THEN
        RAISE EXCEPTION 'cliente_id % debe ser un cliente activo con comercial asignado', NEW.cliente_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_descuentos_cliente_producto_validar
BEFORE INSERT OR UPDATE OF cliente_id ON descuentos_cliente_producto
FOR EACH ROW EXECUTE FUNCTION fn_descuento_cliente_validar();

-- ---------------------------------------------------------------------------
-- Promociones generales de tienda. Si coinciden varias condiciones elegibles,
-- la aplicación selecciona el porcentaje más alto; nunca se acumulan.
-- ---------------------------------------------------------------------------
CREATE TABLE promociones_tienda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(180) NOT NULL,
    descripcion TEXT,
    descuento_porcentaje NUMERIC(5,2) NOT NULL
        CHECK (descuento_porcentaje > 0 AND descuento_porcentaje <= 100),
    fecha_inicio DATE NOT NULL DEFAULT fn_hoy(),
    fecha_fin DATE,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    creado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_promocion_fechas CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio),
    CONSTRAINT chk_promociones_tienda_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE INDEX ix_promociones_tienda_vigencia
    ON promociones_tienda (fecha_inicio, fecha_fin)
    WHERE borrado = FALSE AND activa = TRUE;

-- ---------------------------------------------------------------------------
-- Pedidos: cliente comprador, persona que lo registró y comercial responsable son roles distintos.
-- ---------------------------------------------------------------------------
CREATE TABLE pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_pedido BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    cliente_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    creado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    comercial_id UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    estado estado_pedido NOT NULL DEFAULT 'solicitado',
    fecha_pedido TIMESTAMPTZ NOT NULL DEFAULT now(),
    observaciones TEXT,
    -- Solo EUR por ahora.
    moneda CHAR(3) NOT NULL DEFAULT 'EUR' CHECK (moneda = 'EUR'),
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_pedidos_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL))
);
CREATE INDEX ix_pedidos_cliente_fecha ON pedidos (cliente_id, fecha_pedido DESC) WHERE borrado = FALSE;
CREATE INDEX ix_pedidos_comercial_fecha ON pedidos (comercial_id, fecha_pedido DESC) WHERE borrado = FALSE;
CREATE INDEX ix_pedidos_estado_fecha ON pedidos (estado, fecha_pedido DESC) WHERE borrado = FALSE;

CREATE TABLE pedido_lineas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    referencia_producto VARCHAR(100) NOT NULL,
    nombre_producto VARCHAR(240) NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
    descuento_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
    descuento_origen VARCHAR(30) NOT NULL DEFAULT 'ninguno'
        CHECK (descuento_origen IN ('ninguno', 'cliente_general', 'cliente_producto', 'promocion_tienda', 'ajuste_comercial')),
    descuento_importe NUMERIC(14,2) NOT NULL DEFAULT 0
        CHECK (descuento_importe >= 0),
    iva_porcentaje NUMERIC(5,2) NOT NULL
        CHECK (iva_porcentaje >= 0 AND iva_porcentaje <= 100),
    -- Importes fiscales calculados y guardados como instantánea del pedido.
    base_imponible NUMERIC(14,2) NOT NULL CHECK (base_imponible >= 0),
    cuota_iva NUMERIC(14,2) NOT NULL CHECK (cuota_iva >= 0),
    total_linea NUMERIC(14,2) NOT NULL CHECK (total_linea >= 0),
    borrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_pedido_lineas_borrado
        CHECK ((borrado = FALSE AND deleted_at IS NULL) OR (borrado = TRUE AND deleted_at IS NOT NULL)),
    -- Coherencia de importes (no impone la política de redondeo, solo la suma).
    CONSTRAINT chk_pedido_lineas_total
        CHECK (total_linea = base_imponible + cuota_iva),
    -- origen 'ninguno' <=> porcentaje 0; sin porcentaje no puede haber importe de descuento.
    CONSTRAINT chk_pedido_lineas_descuento_coherente
        CHECK (
            (descuento_origen = 'ninguno') = (descuento_porcentaje = 0)
            AND (descuento_porcentaje > 0 OR descuento_importe = 0)
        ),
    CONSTRAINT chk_pedido_lineas_descuento_max
        CHECK (descuento_importe <= cantidad * precio_unitario)
);
CREATE INDEX ix_pedido_lineas_pedido ON pedido_lineas (pedido_id) WHERE borrado = FALSE;
CREATE INDEX ix_pedido_lineas_producto ON pedido_lineas (producto_id) WHERE borrado = FALSE;

-- Historial de estados: tabla de solo inserción, rellenada automáticamente por trigger.
CREATE TABLE pedido_historial_estados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
    estado_anterior estado_pedido,
    estado_nuevo estado_pedido NOT NULL,
    cambiado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_cambio TIMESTAMPTZ NOT NULL DEFAULT now(),
    nota TEXT
);
CREATE INDEX ix_pedido_historial_pedido_fecha
    ON pedido_historial_estados (pedido_id, fecha_cambio DESC);

-- ---------------------------------------------------------------------------
-- Validación de pedidos: roles, estado inicial, transiciones permitidas e inmutabilidad.
-- Transiciones permitidas:
--   solicitado -> confirmado | cancelado
--   confirmado -> en_preparacion | cancelado
--   en_preparacion -> completado | cancelado
--   completado y cancelado son estados finales.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_pedido_validar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_ok BOOLEAN;
BEGIN
    -- Roles
    IF TG_OP = 'INSERT' OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id THEN
        IF NOT EXISTS (
            SELECT 1 FROM usuarios WHERE id = NEW.cliente_id AND rol = 'cliente' AND borrado = FALSE
        ) THEN
            RAISE EXCEPTION 'cliente_id % no corresponde a un cliente activo', NEW.cliente_id;
        END IF;
    END IF;

    IF NEW.comercial_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.comercial_id IS DISTINCT FROM OLD.comercial_id) THEN
        IF NOT EXISTS (
            SELECT 1 FROM usuarios WHERE id = NEW.comercial_id AND rol = 'comercial' AND borrado = FALSE
        ) THEN
            RAISE EXCEPTION 'comercial_id % no corresponde a un comercial', NEW.comercial_id;
        END IF;
    END IF;

    IF TG_OP = 'INSERT' OR NEW.creado_por IS DISTINCT FROM OLD.creado_por THEN
        IF NOT EXISTS (
            SELECT 1 FROM usuarios WHERE id = NEW.creado_por AND activo = TRUE AND borrado = FALSE
        ) THEN
            RAISE EXCEPTION 'creado_por % no corresponde a un usuario activo', NEW.creado_por;
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.estado <> 'solicitado' THEN
            RAISE EXCEPTION 'Un pedido nuevo debe crearse en estado solicitado';
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE: transiciones de estado
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
        v_ok := CASE OLD.estado
            WHEN 'solicitado'     THEN NEW.estado IN ('confirmado', 'cancelado')
            WHEN 'confirmado'     THEN NEW.estado IN ('en_preparacion', 'cancelado')
            WHEN 'en_preparacion' THEN NEW.estado IN ('completado', 'cancelado')
            ELSE FALSE
        END;
        IF NOT v_ok THEN
            RAISE EXCEPTION 'Transición de estado no permitida: % -> %', OLD.estado, NEW.estado;
        END IF;
    END IF;

    -- Fuera de "solicitado", el cliente y la moneda quedan fijos.
    IF OLD.estado <> 'solicitado'
       AND (NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
            OR NEW.moneda IS DISTINCT FROM OLD.moneda) THEN
        RAISE EXCEPTION 'No se puede cambiar el cliente ni la moneda de un pedido en estado %', OLD.estado;
    END IF;

    -- Un pedido confirmado, en preparación o completado no se borra lógicamente: se cancela.
    IF NEW.borrado AND NOT OLD.borrado AND OLD.estado NOT IN ('solicitado', 'cancelado') THEN
        RAISE EXCEPTION 'No se puede borrar lógicamente un pedido en estado %; cancélalo primero', OLD.estado;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pedidos_validar
BEFORE INSERT OR UPDATE ON pedidos
FOR EACH ROW EXECUTE FUNCTION fn_pedido_validar();

-- Registro automático en el historial. Usa auth.uid() y, opcionalmente, app.nota_estado
-- (SET LOCAL app.nota_estado = '...') como nota del cambio.
CREATE OR REPLACE FUNCTION fn_pedido_registrar_historial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO pedido_historial_estados (pedido_id, estado_anterior, estado_nuevo, cambiado_por, nota)
        VALUES (NEW.id, NULL, NEW.estado, COALESCE(fn_app_user_id(), NEW.creado_por),
                NULLIF(current_setting('app.nota_estado', TRUE), ''));
    ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
        INSERT INTO pedido_historial_estados (pedido_id, estado_anterior, estado_nuevo, cambiado_por, nota)
        VALUES (NEW.id, OLD.estado, NEW.estado, fn_app_user_id(),
                NULLIF(current_setting('app.nota_estado', TRUE), ''));
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_pedidos_historial
AFTER INSERT OR UPDATE OF estado ON pedidos
FOR EACH ROW EXECUTE FUNCTION fn_pedido_registrar_historial();

-- ---------------------------------------------------------------------------
-- Protección en base de datos: las líneas solo se pueden crear/modificar/eliminar
-- mientras el pedido está solicitado. La aplicación debe aplicar permisos adicionales.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_pedido_linea_solo_solicitado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_pedido_id UUID;
    v_estado estado_pedido;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.pedido_id IS DISTINCT FROM OLD.pedido_id THEN
        RAISE EXCEPTION 'No se puede cambiar el pedido de una línea; elimínala y créala en el pedido destino';
    END IF;

    v_pedido_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.pedido_id ELSE NEW.pedido_id END;

    SELECT estado INTO v_estado
    FROM pedidos
    WHERE id = v_pedido_id AND borrado = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el pedido activo %', v_pedido_id;
    END IF;

    IF v_estado <> 'solicitado' THEN
        RAISE EXCEPTION 'Las líneas solo pueden modificarse mientras el pedido está solicitado';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pedido_linea_solo_solicitado
BEFORE INSERT OR UPDATE OR DELETE ON pedido_lineas
FOR EACH ROW EXECUTE FUNCTION fn_pedido_linea_solo_solicitado();

-- ---------------------------------------------------------------------------
-- Auditoría básica genérica para cambios relevantes (solo inserción).
-- ---------------------------------------------------------------------------
CREATE TABLE auditoria (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tabla VARCHAR(100) NOT NULL,
    registro_id UUID NOT NULL,
    accion VARCHAR(30) NOT NULL,
    realizado_por UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip INET
);
CREATE INDEX ix_auditoria_tabla_registro_fecha ON auditoria (tabla, registro_id, fecha DESC);
CREATE INDEX ix_auditoria_fecha ON auditoria (fecha DESC);

-- Auditoría automática de cambios en líneas de pedido (incluye ajustes comerciales).
CREATE OR REPLACE FUNCTION fn_auditar_pedido_linea()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
    v_accion VARCHAR(30);
    v_anterior JSONB;
    v_nuevo JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_id := NEW.id;
        v_accion := 'INSERT';
        v_anterior := NULL;
        v_nuevo := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_id := NEW.id;
        v_accion := 'UPDATE';
        v_anterior := to_jsonb(OLD);
        v_nuevo := to_jsonb(NEW);
    ELSE
        v_id := OLD.id;
        v_accion := 'DELETE';
        v_anterior := to_jsonb(OLD);
        v_nuevo := NULL;
    END IF;

    INSERT INTO auditoria (tabla, registro_id, accion, realizado_por, datos_anteriores, datos_nuevos)
    VALUES ('pedido_lineas', v_id, v_accion, fn_app_user_id(), v_anterior, v_nuevo);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auditar_pedido_linea
AFTER INSERT OR UPDATE OR DELETE ON pedido_lineas
FOR EACH ROW EXECUTE FUNCTION fn_auditar_pedido_linea();

-- Tablas de solo inserción: auditoria y pedido_historial_estados.
CREATE TRIGGER trg_auditoria_solo_insercion
BEFORE UPDATE OR DELETE ON auditoria
FOR EACH ROW EXECUTE FUNCTION fn_bloquear_modificacion();
CREATE TRIGGER trg_auditoria_no_truncate
BEFORE TRUNCATE ON auditoria
FOR EACH STATEMENT EXECUTE FUNCTION fn_bloquear_modificacion();

CREATE TRIGGER trg_pedido_historial_solo_insercion
BEFORE UPDATE OR DELETE ON pedido_historial_estados
FOR EACH ROW EXECUTE FUNCTION fn_bloquear_modificacion();
CREATE TRIGGER trg_pedido_historial_no_truncate
BEFORE TRUNCATE ON pedido_historial_estados
FOR EACH STATEMENT EXECUTE FUNCTION fn_bloquear_modificacion();

-- ---------------------------------------------------------------------------
-- Mantenimiento automático de updated_at en todas las tablas que lo tienen.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'usuarios', 'marcas', 'tipos_producto', 'recursos', 'productos', 'categorias',
        'caracteristicas', 'producto_caracteristica', 'promociones_tienda', 'pedidos', 'pedido_lineas'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()',
            'trg_' || t || '_updated_at', t
        );
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Vistas (usan fn_hoy() en zona Europe/Madrid)
-- ---------------------------------------------------------------------------

-- Vista de productos con su precio vigente (precio SIN IVA).
-- La vista no filtra por cliente: el descuento se calcula en fn_catalogo_para_usuario().
CREATE VIEW v_productos_precio_vigente AS
SELECT
    p.id AS producto_id,
    p.referencia,
    p.nombre,
    p.slug,
    p.descripcion,
    p.tipo_producto_id,
    p.marca_id,
    p.etiqueta_energetica,
    p.imagen_principal_id,
    p.imagen_plano_id,
    pp.precio,
    pp.moneda,
    pp.fecha_inicio AS precio_fecha_inicio
FROM productos p
LEFT JOIN producto_precios pp
    ON pp.producto_id = p.id
   AND pp.borrado = FALSE
   AND pp.fecha_inicio <= fn_hoy()
   AND (pp.fecha_fin IS NULL OR pp.fecha_fin > fn_hoy())
WHERE p.borrado = FALSE
  AND p.activo = TRUE;

-- Vista de descuentos por cliente/producto efectivos hoy.
CREATE VIEW v_descuentos_cliente_producto_vigentes AS
SELECT cliente_id, producto_id, descuento_porcentaje
FROM descuentos_cliente_producto
WHERE borrado = FALSE
  AND fecha_inicio <= fn_hoy()
  AND (fecha_fin IS NULL OR fecha_fin > fn_hoy());

-- Vista de promociones generales vigentes hoy.
CREATE VIEW v_promociones_tienda_vigentes AS
SELECT id, nombre, descripcion, descuento_porcentaje, fecha_inicio, fecha_fin
FROM promociones_tienda
WHERE borrado = FALSE
  AND activa = TRUE
  AND fecha_inicio <= fn_hoy()
  AND (fecha_fin IS NULL OR fecha_fin > fn_hoy());
