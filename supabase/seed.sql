-- ============================================================================
-- seed.sql — Datos de desarrollo. Se ejecuta automáticamente en cada
-- `supabase db reset` (y en `supabase test db`).
--
-- Usuarios de prueba (SOLO desarrollo — nunca en producción):
--   admin@estufas.local     / Admin123!
--   comercial@estufas.local / Comercial123!
--   cliente@estufas.local   / Cliente123!
--   empresa@estufas.local   / Empresa123!   (razón social: Calor Hogar S.L.)
--
-- Marcas ficticias (sin colisión con marcas reales).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Identidades GoTrue. El trigger trg_handle_new_user crea la fila de usuarios
-- a partir de raw_user_meta_data.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
 'authenticated', 'authenticated', 'admin@estufas.local',
 crypt('Admin123!', gen_salt('bf')), now(), now(), now(),
 '{"provider":"email","providers":["email"]}',
 '{"rol":"admin","nombre":"Administrador"}', '', '', '', ''),
('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
 'authenticated', 'authenticated', 'comercial@estufas.local',
 crypt('Comercial123!', gen_salt('bf')), now(), now(), now(),
 '{"provider":"email","providers":["email"]}',
 '{"rol":"comercial","nombre":"Comercial","apellidos":"Prueba"}', '', '', '', ''),
('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
 'authenticated', 'authenticated', 'cliente@estufas.local',
 crypt('Cliente123!', gen_salt('bf')), now(), now(), now(),
 '{"provider":"email","providers":["email"]}',
 '{"rol":"cliente","tipo_cliente":"particular","nombre":"Cliente","apellidos":"Particular"}', '', '', '', ''),
('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444',
 'authenticated', 'authenticated', 'empresa@estufas.local',
 crypt('Empresa123!', gen_salt('bf')), now(), now(), now(),
 '{"provider":"email","providers":["email"]}',
 '{"rol":"cliente","tipo_cliente":"empresa","nombre":"Contacto","apellidos":"Empresa","razon_social":"Calor Hogar S.L.","nif_cif":"B12345678"}', '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Con la migración 0010 el trigger de registro SIEMPRE crea perfiles 'cliente'
-- (el rol de los metadatos se ignora por seguridad). Los perfiles elevados del
-- seed se ascienden aquí explícitamente, como hace el flujo de administración.
INSERT INTO usuarios (id, nombre, apellidos, email, rol, tipo_cliente, pais_facturacion)
VALUES
('11111111-1111-4111-8111-111111111111', 'Administrador', NULL,
 'admin@estufas.local', 'admin', NULL, 'ES'),
('22222222-2222-4222-8222-222222222222', 'Comercial', 'Prueba',
 'comercial@estufas.local', 'comercial', NULL, 'ES')
ON CONFLICT (id) DO UPDATE
SET rol = EXCLUDED.rol,
    tipo_cliente = EXCLUDED.tipo_cliente;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
    gen_random_uuid(),
    id,
    jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
    'email', email, now(), now(), now()
FROM auth.users
WHERE email LIKE '%@estufas.local'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Asignaciones y condiciones comerciales (se ejecuta como postgres, que elude
-- RLS y el trigger de protección de campos).
-- ---------------------------------------------------------------------------
UPDATE usuarios SET id_comercial = '22222222-2222-4222-8222-222222222222'
WHERE email IN ('cliente@estufas.local', 'empresa@estufas.local');

UPDATE usuarios SET descuento_porcentaje = 10.00
WHERE email = 'empresa@estufas.local';

-- ---------------------------------------------------------------------------
-- Marcas y tipos de producto.
-- ---------------------------------------------------------------------------
INSERT INTO marcas (id, nombre, descripcion) VALUES
('a1000000-0000-4000-8000-000000000001', 'Lume',     'Estufas de diseño y alta eficiencia.'),
('a1000000-0000-4000-8000-000000000002', 'TerraFoc', 'Tecnología de combustión avanzada.'),
('a1000000-0000-4000-8000-000000000003', 'EcoCalor', 'Calor sostenible para el hogar.');

INSERT INTO tipos_producto (id, nombre, clave) VALUES
('b1000000-0000-4000-8000-000000000001', 'Estufa',    'estufa'),
('b1000000-0000-4000-8000-000000000002', 'Insertable', 'insertable');

-- ---------------------------------------------------------------------------
-- Categorías agrupadas por dimensión (PRD §4.2) + combustible (pellets/lena).
-- ON CONFLICT: los ids de Hidro/Estufas ya los inserta la migración 0005.
-- ---------------------------------------------------------------------------
INSERT INTO categorias (id, nombre, clave, grupo, orden, combustible) VALUES
('c1000000-0000-4000-8000-000000000001', 'Pellet',     'pellet',     'Combustible', 1, 'pellets'),
('c1000000-0000-4000-8000-000000000002', 'Leña',       'lena',       'Combustible', 2, 'lena'),
('c1000000-0000-4000-8000-000000000003', 'Aire',       'aire',       'Combustible', 3, 'pellets'),
('c1000000-0000-4000-8000-000000000004', 'Insertable', 'insertable', 'Instalación', 1, 'pellets'),
('c1000000-0000-4000-8000-000000000005', 'Canalizada', 'canalizada', 'Instalación', 2, 'pellets'),
('c1000000-0000-4000-8000-000000000006', 'Ventilada',  'ventilada',  'Instalación', 3, 'lena'),
('c1000000-0000-4000-8000-000000000007', 'Fundición',  'fundicion',  'Estilo',      1, 'lena'),
('c1000000-0000-4000-8000-000000000008', 'Hogares',    'hogares',    'Estilo',      2, 'lena'),
('c1000000-0000-4000-8000-000000000009', 'Hidro',      'hidro',      'Instalación', 4, 'pellets'),
('c1000000-0000-4000-8000-000000000010', 'Estufas',    'estufas',    'Estilo',      3, 'lena')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Características (diccionario).
-- ---------------------------------------------------------------------------
INSERT INTO caracteristicas (id, nombre, clave, tipo_dato, unidad, grupo, orden) VALUES
('d1000000-0000-4000-8000-000000000001', 'Potencia nominal',      'potencia_nominal',      'numero', 'kW', 'Datos técnicos', 1),
('d1000000-0000-4000-8000-000000000002', 'Potencia global',       'potencia_global',       'numero', 'kW', 'Datos técnicos', 2),
('d1000000-0000-4000-8000-000000000003', 'Rendimiento',           'rendimiento',           'numero', '%',  'Datos técnicos', 3),
('d1000000-0000-4000-8000-000000000004', 'Volumen calefactable',  'volumen_calefactable',  'numero', 'm³', 'Datos técnicos', 4),
('d1000000-0000-4000-8000-000000000005', 'Capacidad de la tolva', 'capacidad_tolva',       'numero', 'kg', 'Datos técnicos', 5),
('d1000000-0000-4000-8000-000000000006', 'Salida de humos',       'salida_humos',          'numero', 'mm', 'Datos técnicos', 6),
('d1000000-0000-4000-8000-000000000007', 'Peso',                  'peso',                  'numero', 'kg', 'Datos técnicos', 7),
('d1000000-0000-4000-8000-000000000008', 'Medidas',               'medidas',               'texto',  NULL, 'Datos técnicos', 8),
('d1000000-0000-4000-8000-000000000009', 'Programable',           'programable',           'booleano', NULL, 'Prestaciones', 1),
('d1000000-0000-4000-8000-000000000010', 'Autolimpieza quemador', 'autolimpieza_quemador', 'booleano', NULL, 'Prestaciones', 2),
('d1000000-0000-4000-8000-000000000011', 'Cristal limpio',        'cristal_limpio',        'booleano', NULL, 'Prestaciones', 3),
('d1000000-0000-4000-8000-000000000012', 'Horno',                 'horno',                 'booleano', NULL, 'Prestaciones', 4),
('d1000000-0000-4000-8000-000000000013', 'Ventilada',             'ventilada',             'booleano', NULL, 'Prestaciones', 5);

-- ---------------------------------------------------------------------------
-- Recursos (imágenes de desarrollo vía picsum; en producción: Supabase Storage).
-- ---------------------------------------------------------------------------
INSERT INTO recursos (id, nombre, tipo, url, texto_alternativo) VALUES
('e1000000-0000-4000-8000-000000000001', 'LP-9 principal', 'imagen', 'https://picsum.photos/seed/estufa-lp9/900/900',   'Estufa Pellet Lume 9'),
('e1000000-0000-4000-8000-000000000002', 'TF-12 principal', 'imagen', 'https://picsum.photos/seed/estufa-tf12/900/900',  'Estufa Pellet TerraFoc 12'),
('e1000000-0000-4000-8000-000000000003', 'LL-7 principal', 'imagen', 'https://picsum.photos/seed/estufa-ll7/900/900',    'Estufa Leña Lume Clásica'),
('e1000000-0000-4000-8000-000000000004', 'EF-8 principal', 'imagen', 'https://picsum.photos/seed/estufa-ef8/900/900',    'Estufa Leña EcoCalor Forja'),
('e1000000-0000-4000-8000-000000000005', 'TF-70 principal', 'imagen', 'https://picsum.photos/seed/estufa-tf70/900/900',   'Insertable Pellet TerraFoc 70'),
('e1000000-0000-4000-8000-000000000006', 'LA-5 principal', 'imagen', 'https://picsum.photos/seed/estufa-la5/900/900',     'Estufa Aire Ventilada Lume Air'),
('e1000000-0000-4000-8000-000000000007', 'LP-9 galería 2', 'imagen', 'https://picsum.photos/seed/estufa-lp9-2/900/900',   'Detalle Lume 9'),
('e1000000-0000-4000-8000-000000000008', 'TF-12 galería 2', 'imagen', 'https://picsum.photos/seed/estufa-tf12-2/900/900', 'Detalle TerraFoc 12'),
('e1000000-0000-4000-8000-000000000009', 'LL-7 galería 2', 'imagen', 'https://picsum.photos/seed/estufa-ll7-2/900/900',   'Detalle Clásica'),
('e1000000-0000-4000-8000-000000000010', 'EF-8 galería 2', 'imagen', 'https://picsum.photos/seed/estufa-ef8-2/900/900',   'Detalle Forja');

-- ---------------------------------------------------------------------------
-- Productos.
-- ---------------------------------------------------------------------------
INSERT INTO productos (id, referencia, nombre, slug, descripcion, tipo_producto_id, marca_id, etiqueta_energetica, imagen_principal_id, destacado)
VALUES
('f1000000-0000-4000-8000-000000000001', 'LP-9',  'Estufa Pellet Lume 9',
 'estufa-pellet-lume-9',
 'Estufa de pellet de 9 kW con encendido rápido, programación semanal y sistema de cristal limpio. Ideal para salones de hasta 220 m³.',
 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'A+',
 'e1000000-0000-4000-8000-000000000001', TRUE),
('f1000000-0000-4000-8000-000000000002', 'TF-12', 'Estufa Pellet TerraFoc 12',
 'estufa-pellet-terrafoc-12',
 'Pellet de alta gama con 12 kW de potencia, tolva de 20 kg y autolimpieza del quemador.',
 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'A++',
 'e1000000-0000-4000-8000-000000000002', TRUE),
('f1000000-0000-4000-8000-000000000003', 'LL-7',  'Estufa Leña Lume Clásica',
 'estufa-lena-lume-clasica',
 'Estufa de leña de fundición con horno, aire primario y secundario. Un clásico para el hogar.',
 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', NULL,
 'e1000000-0000-4000-8000-000000000003', FALSE),
('f1000000-0000-4000-8000-000000000004', 'EF-8',  'Estufa Leña EcoCalor Forja',
 'estufa-lena-ecocalor-forja',
 'Leña con partes en fundición y horno integrado. Diseño de forja con gran inercia térmica.',
 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', NULL,
 'e1000000-0000-4000-8000-000000000004', FALSE),
('f1000000-0000-4000-8000-000000000005', 'TF-70', 'Insertable Pellet TerraFoc 70',
 'insertable-pellet-terrafoc-70',
 'Insertable de pellet de 11 kW para chimeneas existentes, con salida de humos estándar.',
 'b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', NULL,
 'e1000000-0000-4000-8000-000000000005', FALSE),
('f1000000-0000-4000-8000-000000000006', 'LA-5',  'Estufa Aire Ventilada Lume Air',
 'estufa-aire-ventilada-lume-air',
 'Estufa de aire ventilada de 5 kW, ligera y eficiente para espacios pequeños.',
 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', NULL,
 'e1000000-0000-4000-8000-000000000006', FALSE),
('f1000000-0000-4000-8000-000000000007', 'TF-X', 'Estufa Pellet TerraFoc X (borrador)',
 'estufa-pellet-terrafoc-x',
 'Producto no publicado: solo visible para administradores.',
 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', NULL,
 'e1000000-0000-4000-8000-000000000002', FALSE);

-- ---------------------------------------------------------------------------
-- Proveedores (multi-empresa) y asociaciones producto → proveedor.
-- (Prefijo "91..." porque los UUID solo admiten hex; p1000000 no es válido.)
-- El comercial 2222 tiene habilitados los proveedores 1 y 2; el 3 NO: LA-5
-- queda oculto para sus clientes hasta que el admin lo asigne/habilite.
-- ---------------------------------------------------------------------------
INSERT INTO proveedores (id, nombre, nif, email, telefono) VALUES
('91000000-0000-4000-8000-000000000001', 'Estufas Norte S.L.', 'B11111111', 'norte@proveedores.local', NULL),
('91000000-0000-4000-8000-000000000002', 'Calor Hogar S.L.',   'B22222222', NULL, NULL),
('91000000-0000-4000-8000-000000000003', 'EcoCalor Global',    'B33333333', NULL, NULL);

UPDATE productos SET proveedor_id = '91000000-0000-4000-8000-000000000001'
WHERE referencia IN ('LP-9', 'TF-12', 'TF-70', 'TF-X');
UPDATE productos SET proveedor_id = '91000000-0000-4000-8000-000000000002'
WHERE referencia IN ('LL-7', 'EF-8');
UPDATE productos SET proveedor_id = '91000000-0000-4000-8000-000000000003'
WHERE referencia = 'LA-5';

INSERT INTO comercial_proveedor (comercial_id, proveedor_id, habilitado, creado_por) VALUES
('22222222-2222-4222-8222-222222222222', '91000000-0000-4000-8000-000000000001', TRUE, '11111111-1111-4111-8111-111111111111'),
('22222222-2222-4222-8222-222222222222', '91000000-0000-4000-8000-000000000002', TRUE, '11111111-1111-4111-8111-111111111111');

-- Galerías.
INSERT INTO producto_recurso (producto_id, recurso_id, tipo_en_producto, orden) VALUES
('f1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000007', 'galeria', 2),
('f1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000008', 'galeria', 2),
('f1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000009', 'galeria', 2),
('f1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000010', 'galeria', 2);

-- Categorías por producto.
INSERT INTO producto_categoria (producto_id, categoria_id) VALUES
('f1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001'),
('f1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001'),
('f1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002'),
('f1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000007'),
('f1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000008'),
('f1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000002'),
('f1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000007'),
('f1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001'),
('f1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000004'),
('f1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000003'),
('f1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000006');

-- Características por producto.
INSERT INTO producto_caracteristica (producto_id, caracteristica_id, valor_numero, valor_texto, valor_booleano) VALUES
('f1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 9,    NULL, NULL),
('f1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 9.5,  NULL, NULL),
('f1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000003', 90,   NULL, NULL),
('f1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000004', 220,  NULL, NULL),
('f1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000005', 15,   NULL, NULL),
('f1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000006', 80,   NULL, NULL),
('f1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000007', 120,  NULL, NULL),
('f1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000008', NULL, '95 × 105 × 52 cm', NULL),
('f1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000009', NULL, NULL, TRUE),
('f1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000010', NULL, NULL, TRUE),
('f1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000011', NULL, NULL, TRUE),
('f1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 12,   NULL, NULL),
('f1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000003', 92,   NULL, NULL),
('f1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000004', 280,  NULL, NULL),
('f1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000005', 20,   NULL, NULL),
('f1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000007', 140,  NULL, NULL),
('f1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000009', NULL, NULL, TRUE),
('f1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000010', NULL, NULL, TRUE),
('f1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000011', NULL, NULL, TRUE),
('f1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001', 7,    NULL, NULL),
('f1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000003', 78,   NULL, NULL),
('f1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000006', 150,  NULL, NULL),
('f1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000007', 110,  NULL, NULL),
('f1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000008', NULL, '85 × 90 × 55 cm', NULL),
('f1000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000012', NULL, NULL, TRUE),
('f1000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000001', 8,    NULL, NULL),
('f1000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000003', 80,   NULL, NULL),
('f1000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000007', 95,   NULL, NULL),
('f1000000-0000-4000-8000-000000000004', 'd1000000-0000-4000-8000-000000000012', NULL, NULL, TRUE),
('f1000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000001', 11,   NULL, NULL),
('f1000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000003', 91,   NULL, NULL),
('f1000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000005', 18,   NULL, NULL),
('f1000000-0000-4000-8000-000000000005', 'd1000000-0000-4000-8000-000000000009', NULL, NULL, TRUE),
('f1000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000001', 5,    NULL, NULL),
('f1000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000003', 85,   NULL, NULL),
('f1000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000007', 60,   NULL, NULL),
('f1000000-0000-4000-8000-000000000006', 'd1000000-0000-4000-8000-000000000013', NULL, NULL, TRUE);

-- ---------------------------------------------------------------------------
-- Estufas: rellena productos.datos desde producto_caracteristica (misma lógica
-- que la migración 0009, idempotente: solo productos con datos = '[]').
-- ---------------------------------------------------------------------------
UPDATE productos p
SET datos = COALESCE((
    SELECT jsonb_agg(
        jsonb_build_object('grupo', x.grupo, 'filas', x.filas)
        ORDER BY x.orden_min
    )
    FROM (
        SELECT
            c.grupo,
            MIN(c.orden) AS orden_min,
            jsonb_agg(
                jsonb_build_object(
                    'clave',  c.clave,
                    'nombre', c.nombre,
                    'unidad', to_jsonb(c.unidad),
                    'valor',  CASE c.tipo_dato
                        WHEN 'texto'    THEN to_jsonb(pc.valor_texto)
                        WHEN 'numero'   THEN to_jsonb(pc.valor_numero)
                        WHEN 'booleano' THEN to_jsonb(pc.valor_booleano)
                    END
                )
                ORDER BY c.orden, c.nombre
            ) AS filas
        FROM producto_caracteristica pc
        JOIN caracteristicas c ON c.id = pc.caracteristica_id
        WHERE pc.producto_id = p.id
          AND pc.borrado = FALSE
          AND c.borrado = FALSE
        GROUP BY c.grupo
    ) x
), '[]'::jsonb)
WHERE p.datos = '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Precios vigentes (SIN IVA).
-- ---------------------------------------------------------------------------
INSERT INTO producto_precios (producto_id, precio, fecha_inicio, creado_por) VALUES
('f1000000-0000-4000-8000-000000000001', 999.00,  fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f1000000-0000-4000-8000-000000000002', 1499.00, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f1000000-0000-4000-8000-000000000003', 649.00,  fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f1000000-0000-4000-8000-000000000004', 899.00,  fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f1000000-0000-4000-8000-000000000005', 1299.00, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f1000000-0000-4000-8000-000000000006', 549.00,  fn_hoy(), '11111111-1111-4111-8111-111111111111');

-- El producto borrador TF-X no se publica (activo = FALSE).
UPDATE productos SET activo = FALSE WHERE id = 'f1000000-0000-4000-8000-000000000007';

-- ---------------------------------------------------------------------------
-- Promoción general de tienda de ejemplo (5%).
-- ---------------------------------------------------------------------------
INSERT INTO promociones_tienda (nombre, descripcion, descuento_porcentaje, activa, creado_por) VALUES
('Promo Bienvenida', '5% de descuento en todo el catálogo.', 5.00, TRUE, '11111111-1111-4111-8111-111111111111');

-- ---------------------------------------------------------------------------
-- Descuento específico de ejemplo: el 0% SUSTITUYE al descuento general del
-- 10% de la empresa en el producto LP-9 (excepción válida, PRD §6.3).
-- ---------------------------------------------------------------------------
INSERT INTO descuentos_cliente_producto (cliente_id, producto_id, descuento_porcentaje, creado_por) VALUES
('44444444-4444-4444-8444-444444444444', 'f1000000-0000-4000-8000-000000000001', 0.00, '22222222-2222-4222-8222-222222222222');

-- Sin ejemplos de descuento por combustible (descuentos_cliente_combustible):
-- un ejemplo aquí alteraría los resultados de los tests 03; los tests 06 crean
-- y anulan sus filas dentro de sus propias transacciones.

-- ============================================================================
-- Catálogo "Eider Biomasa" (PDF docs/gama_fuego.txt, páginas 3-14).
-- Todos los INSERT son RE-EJECUTABLES (ON CONFLICT) para poder aplicarse
-- también sobre una BD viva sin reset. Los ids usan el prefijo "f2..." para
-- no chocar con los productos base "f1...".
-- ============================================================================

-- Proveedor y asignación al comercial de desarrollo.
INSERT INTO proveedores (id, nombre, nif) VALUES
('91000000-0000-4000-8000-000000000004', 'Eider Biomasa', 'B95000000')
ON CONFLICT (id) DO NOTHING;

INSERT INTO comercial_proveedor (comercial_id, proveedor_id) VALUES
('22222222-2222-4222-8222-222222222222', '91000000-0000-4000-8000-000000000004')
ON CONFLICT (comercial_id, proveedor_id) DO NOTHING;

-- Tipos de producto.
INSERT INTO tipos_producto (id, nombre, clave) VALUES
('b1000000-0000-4000-8000-000000000003', 'Combustible', 'combustible'),
('b1000000-0000-4000-8000-000000000004', 'Accesorio',   'accesorio')
ON CONFLICT (clave) WHERE borrado = FALSE DO NOTHING;

-- Categorías (gamas; combustible NULL = agnósticas). Los ids 009/010 ya están
-- ocupados por Hidro/Estufas (0005), así que las gamas usan 011-015.
INSERT INTO categorias (id, nombre, clave, grupo, orden, combustible) VALUES
('c1000000-0000-4000-8000-000000000011', 'Combustible',         'combustible',       'Gama', 1, NULL),
('c1000000-0000-4000-8000-000000000012', 'Fuego',               'fuego',             'Gama', 2, NULL),
('c1000000-0000-4000-8000-000000000013', 'Fuego EKO',           'fuego-eko',         'Gama', 3, NULL),
('c1000000-0000-4000-8000-000000000014', 'Citronela',           'citronela',         'Gama', 4, NULL),
('c1000000-0000-4000-8000-000000000015', 'Cerillas y mecheros', 'cerillas-mecheros', 'Gama', 5, NULL)
ON CONFLICT (clave) WHERE borrado = FALSE DO NOTHING;

-- ---------------------------------------------------------------------------
-- Productos Eider (95). descripcion/marca/etiqueta/imagen NULL, destacado
-- FALSE, activo TRUE. datos sigue el contrato 0009: array de grupos
-- [{"grupo": ..., "filas": [{"clave","nombre","valor","unidad"}]}].
-- ---------------------------------------------------------------------------
INSERT INTO productos (id, referencia, nombre, slug, descripcion, tipo_producto_id, marca_id, etiqueta_energetica, imagen_principal_id, destacado, activo, proveedor_id, datos)
VALUES
-- Gama Combustible (páginas 3-4)
('f2000000-0000-4000-8000-000000000001', 'EID-001', 'Saco De Pellets 15 Kg Fireplus', 'eid-001-saco-de-pellets-15-kg-fireplus', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"15 kg","unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000002', 'EID-002', 'Saco De Pellets 15 Kg Biofire', 'eid-002-saco-de-pellets-15-kg-biofire', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"15 kg","unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000003', 'EID-003', 'Saco Carbon 10 Litros', 'eid-003-saco-carbon-10-litros', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[]'::jsonb),
('f2000000-0000-4000-8000-000000000004', 'EID-004', 'Saco Carbon 3 Kg', 'eid-004-saco-carbon-3-kg', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"3 kg","unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000005', 'EID-005', 'Saco Carbon 10 Kg', 'eid-005-saco-carbon-10-kg', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"10 kg","unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000006', 'EID-006', 'Saco De Briquetas De Carbon 3 Kg', 'eid-006-saco-de-briquetas-de-carbon-3-kg', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"3 kg","unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000007', 'EID-007', 'Biocarbon 15 Dm3', 'eid-007-biocarbon-15-dm3', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[]'::jsonb),
('f2000000-0000-4000-8000-000000000008', 'EID-008', 'Biocarbon 30 Dm3', 'eid-008-biocarbon-30-dm3', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[]'::jsonb),
('f2000000-0000-4000-8000-000000000009', 'EID-009', 'Biocarbon 60 Dm3', 'eid-009-biocarbon-60-dm3', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[]'::jsonb),
('f2000000-0000-4000-8000-000000000010', 'EID-010', 'Saco Leña 10 Kg', 'eid-010-saco-lena-10-kg', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"10 kg","unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000011', 'EID-011', 'Saco Leña 15 Kg', 'eid-011-saco-lena-15-kg', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"15 kg","unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000012', 'EID-012', 'Saco Astillas De Pino', 'eid-012-saco-astillas-de-pino', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"6 kg","unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000013', 'EID-013', 'Briquetas De Madera 7 Kg', 'eid-013-briquetas-de-madera-7-kg', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"7 kg","unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000014', 'EID-014', 'Briquetas De Madera 15 Kg', 'eid-014-briquetas-de-madera-15-kg', NULL, 'b1000000-0000-4000-8000-000000000003', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"15 kg","unidad":null}]}]'::jsonb),
-- Gama Fuego (página 5)
('f2000000-0000-4000-8000-000000000015', 'CB640002', '32 Pastillas De Encendido De Parafina', 'cb640002-32-pastillas-de-encendido-de-parafina', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"170 gr","unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000016', 'CB640003', '24 Uds De Lana De Encendido', 'cb640003-24-uds-de-lana-de-encendido', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[]'::jsonb),
('f2000000-0000-4000-8000-000000000017', 'CB640001', 'Líquido De Encendido 1 L', 'cb640001-liquido-de-encendido-1-l', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"1000 gr","unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000018', 'AL643001', 'Limpiacristales 500 Ml', 'al643001-limpiacristales-500-ml', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"500 gr","unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000019', 'CB641001', 'Bioetanol 1 L', 'cb641001-bioetanol-1-l', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"1000 gr","unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000020', 'CB641002', 'Bioetanol 5 L', 'cb641002-bioetanol-5-l', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"5000 gr","unidad":null}]}]'::jsonb),
-- Gama Fuego EKO (páginas 6-8)
('f2000000-0000-4000-8000-000000000021', 'EID-015', 'Pastillas De Encendido Ecológicas (32 Unidades)', 'eid-015-pastillas-de-encendido-ecologicas-32-unidades', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":40,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000022', 'EID-016', 'Pastillas De Encendido Ecológicas (75 Unidades)', 'eid-016-pastillas-de-encendido-ecologicas-75-unidades', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":10,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000023', 'EID-017', 'Encendedores Ecológicos (80 Unidades)', 'eid-017-encendedores-ecologicos-80-unidades', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":11,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000024', 'EID-018', 'Pastillas De Encendido Ecológicas (100 Unidades)', 'eid-018-pastillas-de-encendido-ecologicas-100-unidades', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":11,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000025', 'EID-019', 'Pastillas De Encendido Ecológicas (150 Unidades)', 'eid-019-pastillas-de-encendido-ecologicas-150-unidades', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":11,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000026', 'EID-020', 'Pastillas De Encendido Ecológicas (30 Unidades)', 'eid-020-pastillas-de-encendido-ecologicas-30-unidades', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":8,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000027', 'EID-021', 'Encendedores Ecológicos (Paquete De 40)', 'eid-021-encendedores-ecologicos-paquete-de-40', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":8,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000028', 'EID-022', 'Pastillas De Encendido (Paquete De 40) Fibra De Madera E Hidrocarburos', 'eid-022-pastillas-de-encendido-paquete-de-40-fibra-de-madera-e-hidrocarburos', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":40,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000029', 'EID-023', 'Pastillas De Encendido Blancas De Queroseno (48 Unidades)', 'eid-023-pastillas-de-encendido-blancas-de-queroseno-48-unidades', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":28,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000030', 'EID-024', 'Mezcla De Combustible 1 L', 'eid-024-mezcla-de-combustible-1-l', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000031', 'EID-025', 'Iniciador De Fuego', 'eid-025-iniciador-de-fuego', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":24,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000032', 'EID-026', 'Leño', 'eid-026-leno', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000033', 'EID-027', 'Spray Limpiador Para Parrillas 750 Ml', 'eid-027-spray-limpiador-para-parrillas-750-ml', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000034', 'EID-028', 'Spray Limpiacristales 750 Ml', 'eid-028-spray-limpiacristales-750-ml', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000035', 'EID-029', 'Spray Limpiador Para Piedra Y Chimeneas 750 Ml', 'eid-029-spray-limpiador-para-piedra-y-chimeneas-750-ml', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000036', 'EID-030', 'Registro De Limpieza De Chimeneas', 'eid-030-registro-de-limpieza-de-chimeneas', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000037', 'EID-031', 'Barbacoa Lista Para Usar Braceveloce', 'eid-031-barbacoa-lista-para-usar-braceveloce', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":1,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000038', 'EID-032', 'Expositor De Mostrador Para Barbacoa Braceveloce', 'eid-032-expositor-de-mostrador-para-barbacoa-braceveloce', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":10,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000039', 'EID-033', 'Barbacoa Pallbox Fast Grill Lista Para Usar Braceveloce', 'eid-033-barbacoa-pallbox-fast-grill-lista-para-usar-braceveloce', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":26,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000040', 'EID-034', '3 Kg De Briquetas', 'eid-034-3-kg-de-briquetas', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":250,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000041', 'EID-035', 'Briquetas De 5 Kg', 'eid-035-briquetas-de-5-kg', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":150,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000042', 'EID-036', 'Briquetas De 10 Kg', 'eid-036-briquetas-de-10-kg', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":75,"unidad":null}]}]'::jsonb),
-- Gama Citronela (páginas 9-13)
('f2000000-0000-4000-8000-000000000043', 'EID-037', 'Antorcha De Aluminio Con Citronela, Pequeña (11x2)', 'eid-037-antorcha-de-aluminio-con-citronela-pequena-11x2', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"70 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":60,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000044', 'EID-038', 'Antorcha De Aluminio Con Citronela, Mediana (14x2)', 'eid-038-antorcha-de-aluminio-con-citronela-mediana-14x2', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"100 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":36,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000045', 'EID-039', 'Antorcha De Aluminio Con Citronela, Maxi (16,5x2,2)', 'eid-039-antorcha-de-aluminio-con-citronela-maxi-16-5x2-2', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"160 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":36,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000046', 'EID-040', 'Antorcha De Aluminio Con Citronela, Maxi (16,5x2,2) (Marrón)', 'eid-040-antorcha-de-aluminio-con-citronela-maxi-16-5x2-2-marron', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"160 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":36,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000047', 'EID-041', 'Recipiente De Aluminio Con Citronela (7,5x4)', 'eid-041-recipiente-de-aluminio-con-citronela-7-5x4', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"70 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":60,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000048', 'EID-042', '2 Recipientes De Aluminio Con Citronela (7,5x4)', 'eid-042-2-recipientes-de-aluminio-con-citronela-7-5x4', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"2x70 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000049', 'EID-043', 'Antorcha De Aluminio Con Citronela (Paquete De 3) (14x2)', 'eid-043-antorcha-de-aluminio-con-citronela-paquete-de-3-14x2', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"3X100 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000050', 'EID-044', 'Antorcha De Aluminio Con Citronela (Paquete De 3) (16,5x2,2)', 'eid-044-antorcha-de-aluminio-con-citronela-paquete-de-3-16-5x2-2', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"3X160 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000051', 'EID-045', 'Antorcha De Terracota Con Citronela, Pequeña (11x2,5)', 'eid-045-antorcha-de-terracota-con-citronela-pequena-11x2-5', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"80 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":53,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000052', 'EID-046', 'Antorcha De Terracota Con Citronela, Mediana (14,5x3)', 'eid-046-antorcha-de-terracota-con-citronela-mediana-14-5x3', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"130 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":30,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000053', 'EID-047', 'Antorcha De Terracota Con Citronela, Maxi (16,5x3,5)', 'eid-047-antorcha-de-terracota-con-citronela-maxi-16-5x3-5', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"170 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":25,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000054', 'EID-048', 'Antorcha De Terracota Con Citronela (Paquete De 3) (14,5x3)', 'eid-048-antorcha-de-terracota-con-citronela-paquete-de-3-14-5x3', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"3X130 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000055', 'EID-049', 'Antorcha De Terracota Con Citronela (Paquete De 3) (17x3)', 'eid-049-antorcha-de-terracota-con-citronela-paquete-de-3-17x3', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"3X170 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000056', 'EID-050', '2 Recipientes De Terracota Con Citronela (9x5) 80 Gr', 'eid-050-2-recipientes-de-terracota-con-citronela-9x5-80-gr', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"80 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":44,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000057', 'EID-051', '2 Recipientes De Terracota Con Citronela (9x5) 2x80 Gr', 'eid-051-2-recipientes-de-terracota-con-citronela-9x5-2x80-gr', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"2x80gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000058', 'EID-052', 'Recipiente De Terracota Con Citronela (7x6)', 'eid-052-recipiente-de-terracota-con-citronela-7x6', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"50 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":48,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000059', 'EID-053', 'Recipiente De Terracota Con Citronela (9x8)', 'eid-053-recipiente-de-terracota-con-citronela-9x8', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"80 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":24,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000060', 'EID-054', 'Recipiente De Terracota Con Citronela (11x10)', 'eid-054-recipiente-de-terracota-con-citronela-11x10', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"260 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000061', 'EID-055', 'Recipiente De Terracota Con Citronela (14x13)', 'eid-055-recipiente-de-terracota-con-citronela-14x13', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"300 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000062', 'EID-056', 'Vela En Recipiente Ecológico (6x8 Cm)', 'eid-056-vela-en-recipiente-ecologico-6x8-cm', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"60 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":30,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000063', 'EID-057', 'Vela En Recipiente Ecológico (8x10 Cm)', 'eid-057-vela-en-recipiente-ecologico-8x10-cm', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"120 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":24,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000064', 'EID-058', 'Vela De Citronela En Vaso De Vidrio (7,8x8)', 'eid-058-vela-de-citronela-en-vaso-de-vidrio-7-8x8', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"120 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000065', 'EID-059', 'Vela De Citronela En Vaso De Vidrio (6x7)', 'eid-059-vela-de-citronela-en-vaso-de-vidrio-6x7', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"45 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000066', 'EID-060', 'Vela De Citronela En Tarro (10x13)', 'eid-060-vela-de-citronela-en-tarro-10x13', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"250 gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":6,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000067', 'EID-061', '10 Velas De Té De Citronela (3,6x1,7)', 'eid-061-10-velas-de-te-de-citronela-3-6x1-7', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"11gr x 10","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":24,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000068', 'EID-062', '25 Velas De Té De Citronela (3,6x1,7)', 'eid-062-25-velas-de-te-de-citronela-3-6x1-7', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"11gr x 25","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":32,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000069', 'EID-063', '50 Velas De Té De Citronela (3,6x1,7)', 'eid-063-50-velas-de-te-de-citronela-3-6x1-7', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"11gr x 50","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":16,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000070', 'EID-064', '100 Velas De Té De Citronela (3,6x1,7)', 'eid-064-100-velas-de-te-de-citronela-3-6x1-7', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"11gr x 100","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":8,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000071', 'EID-065', '3 Velas De Té Maxi De Citronela (6x2,3)', 'eid-065-3-velas-de-te-maxi-de-citronela-6x2-3', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"30gr x 3","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":24,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000072', 'EID-066', '6 Velas De Té Maxi De Citronela (6x2,5)', 'eid-066-6-velas-de-te-maxi-de-citronela-6x2-5', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"30gr x 6","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000073', 'EID-067', 'Vela Cilíndrica De Citronela (5x9)', 'eid-067-vela-cilindrica-de-citronela-5x9', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"130gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":4,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000074', 'EID-068', 'Vela Cilíndrica De Citronela (6x12)', 'eid-068-vela-cilindrica-de-citronela-6x12', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"220gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000075', 'EID-069', 'Vela Cilíndrica De Citronela 7x10', 'eid-069-vela-cilindrica-de-citronela-7x10', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"285gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000076', 'EID-070', 'Vela De Columna Rústica De Citronela 7x10', 'eid-070-vela-de-columna-rustica-de-citronela-7x10', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"280gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000077', 'EID-071', 'Vela De Columna Rústica De Citronela 10x10', 'eid-071-vela-de-columna-rustica-de-citronela-10x10', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"610gr","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":10,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000078', 'EID-072', 'Difusor De Citronela 125 Ml', 'eid-072-difusor-de-citronela-125-ml', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"125ml","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":24,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000079', 'EID-073', 'Aceite De Citronela 100 % Vegetal Para Antorchas De Bambú', 'eid-073-aceite-de-citronela-100-vegetal-para-antorchas-de-bambu', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"1 lt","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000080', 'EID-074', 'Limpiador De Suelos Con Aroma A Citronela Y Aceite De Pino', 'eid-074-limpiador-de-suelos-con-aroma-a-citronela-y-aceite-de-pino', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"1 LT","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000081', 'EID-075', 'Limpiador Multiusos En Spray Con Aroma A Citronela Y Aceite De Pino', 'eid-075-limpiador-multiusos-en-spray-con-aroma-a-citronela-y-aceite-de-pino', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"750ML","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000082', 'EID-076', 'Ambientador En Spray Con Aroma A Citronela Y Aceite De Pino', 'eid-076-ambientador-en-spray-con-aroma-a-citronela-y-aceite-de-pino', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"peso","nombre":"Peso","valor":"250ML","unidad":null},{"clave":"uds_caja","nombre":"Unidades por caja","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000083', 'EID-077', 'Expositor De Productos Variados', 'eid-077-expositor-de-productos-variados', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":1,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000084', 'EID-078', 'Caja Palé De Producto Único', 'eid-078-caja-pale-de-producto-unico', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"uds_caja","nombre":"Unidades por caja","valor":1,"unidad":null}]}]'::jsonb),
-- Gama Cerillas y mecheros (página 14)
('f2000000-0000-4000-8000-000000000085', 'EID-079', 'Cerilla Pack 10 Fumador', 'eid-079-cerilla-pack-10-fumador', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"unidad_venta","nombre":"Unidad de venta","valor":"PACK 10","unidad":null}]},{"grupo":"Dimensiones unidad de venta","filas":[{"clave":"alto","nombre":"Alto","valor":7.1,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":3.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":7.1,"unidad":"cm"}]},{"grupo":"Dimensiones caja","filas":[{"clave":"alto","nombre":"Alto","valor":30,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":21.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":37,"unidad":"cm"}]},{"grupo":"Logística","filas":[{"clave":"unidades_por_caja","nombre":"Unidades por caja","valor":100,"unidad":null},{"clave":"peso_caja_kg","nombre":"Peso caja","valor":7.1,"unidad":null},{"clave":"cajas_por_manto","nombre":"Cajas por manto","valor":9,"unidad":null},{"clave":"cajas_por_palet","nombre":"Cajas por palet","valor":45,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000086', 'EID-080', 'Cerilla Pack 3 47 Mm', 'eid-080-cerilla-pack-3-47-mm', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"unidad_venta","nombre":"Unidad de venta","valor":"PACK3","unidad":null}]},{"grupo":"Dimensiones unidad de venta","filas":[{"clave":"alto","nombre":"Alto","valor":6.7,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":7.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":12,"unidad":"cm"}]},{"grupo":"Dimensiones caja","filas":[{"clave":"alto","nombre":"Alto","valor":39,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":25,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":27,"unidad":"cm"}]},{"grupo":"Logística","filas":[{"clave":"unidades_por_caja","nombre":"Unidades por caja","valor":40,"unidad":null},{"clave":"peso_caja_kg","nombre":"Peso caja","valor":4.9,"unidad":null},{"clave":"cajas_por_manto","nombre":"Cajas por manto","valor":10,"unidad":null},{"clave":"cajas_por_palet","nombre":"Cajas por palet","valor":60,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000087', 'EID-081', 'Cerilla De Cocina Pack 4 55 Mm', 'eid-081-cerilla-de-cocina-pack-4-55-mm', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"unidad_venta","nombre":"Unidad de venta","valor":"PACK4","unidad":null}]},{"grupo":"Dimensiones unidad de venta","filas":[{"clave":"alto","nombre":"Alto","valor":5.5,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":5.7,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":9.1,"unidad":"cm"}]},{"grupo":"Dimensiones caja","filas":[{"clave":"alto","nombre":"Alto","valor":39,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":32.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":47,"unidad":"cm"}]},{"grupo":"Logística","filas":[{"clave":"unidades_por_caja","nombre":"Unidades por caja","valor":128,"unidad":null},{"clave":"peso_caja_kg","nombre":"Peso caja","valor":14.8,"unidad":null},{"clave":"cajas_por_manto","nombre":"Cajas por manto","valor":5,"unidad":null},{"clave":"cajas_por_palet","nombre":"Cajas por palet","valor":20,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000088', 'EID-082', 'Cerilla Extra Larga 100 Mm', 'eid-082-cerilla-extra-larga-100-mm', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"unidad_venta","nombre":"Unidad de venta","valor":"UNIDAD","unidad":null}]},{"grupo":"Dimensiones unidad de venta","filas":[{"clave":"alto","nombre":"Alto","valor":2,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":6.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":11,"unidad":"cm"}]},{"grupo":"Dimensiones caja","filas":[{"clave":"alto","nombre":"Alto","valor":33,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":27.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":57.5,"unidad":"cm"}]},{"grupo":"Logística","filas":[{"clave":"unidades_por_caja","nombre":"Unidades por caja","valor":300,"unidad":null},{"clave":"peso_caja_kg","nombre":"Peso caja","valor":12.3,"unidad":null},{"clave":"cajas_por_manto","nombre":"Cajas por manto","valor":5,"unidad":null},{"clave":"cajas_por_palet","nombre":"Cajas por palet","valor":20,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000089', 'EID-083', 'Cerilla Xxl Extra Larga 170 Mm', 'eid-083-cerilla-xxl-extra-larga-170-mm', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"unidad_venta","nombre":"Unidad de venta","valor":"UNIDAD","unidad":null}]},{"grupo":"Dimensiones unidad de venta","filas":[{"clave":"alto","nombre":"Alto","valor":18.1,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":6.6,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":1.8,"unidad":"cm"}]},{"grupo":"Dimensiones caja","filas":[{"clave":"alto","nombre":"Alto","valor":55,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":28.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":38,"unidad":"cm"}]},{"grupo":"Logística","filas":[{"clave":"unidades_por_caja","nombre":"Unidades por caja","valor":200,"unidad":null},{"clave":"peso_caja_kg","nombre":"Peso caja","valor":11.9,"unidad":null},{"clave":"cajas_por_manto","nombre":"Cajas por manto","valor":4,"unidad":null},{"clave":"cajas_por_palet","nombre":"Cajas por palet","valor":16,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000090', 'EID-084', 'Encendedor De Cocina Midi Xhg8911S', 'eid-084-encendedor-de-cocina-midi-xhg8911s', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"unidad_venta","nombre":"Unidad de venta","valor":"UNIDAD","unidad":null}]},{"grupo":"Dimensiones unidad de venta","filas":[{"clave":"alto","nombre":"Alto","valor":27,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":6.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":3.5,"unidad":"cm"}]},{"grupo":"Dimensiones caja","filas":[{"clave":"alto","nombre":"Alto","valor":57,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":39,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":46.5,"unidad":"cm"}]},{"grupo":"Logística","filas":[{"clave":"unidades_por_caja","nombre":"Unidades por caja","valor":288,"unidad":null},{"clave":"peso_caja_kg","nombre":"Peso caja","valor":16.8,"unidad":null},{"clave":"cajas_por_manto","nombre":"Cajas por manto","valor":4,"unidad":null},{"clave":"cajas_por_palet","nombre":"Cajas por palet","valor":12,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000091', 'EID-085', 'Encendedor Electrónico Recargable Pack 3', 'eid-085-encendedor-electronico-recargable-pack-3', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"unidad_venta","nombre":"Unidad de venta","valor":"UNIDAD","unidad":null}]},{"grupo":"Dimensiones unidad de venta","filas":[{"clave":"alto","nombre":"Alto","valor":15.5,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":10.1,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":1.5,"unidad":"cm"}]},{"grupo":"Dimensiones caja","filas":[{"clave":"alto","nombre":"Alto","valor":35.4,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":34.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":54.5,"unidad":"cm"}]},{"grupo":"Logística","filas":[{"clave":"unidades_por_caja","nombre":"Unidades por caja","valor":240,"unidad":null},{"clave":"peso_caja_kg","nombre":"Peso caja","valor":15.8,"unidad":null},{"clave":"cajas_por_manto","nombre":"Cajas por manto","valor":4,"unidad":null},{"clave":"cajas_por_palet","nombre":"Cajas por palet","valor":16,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000092', 'EID-086', 'Encendedor De Piedra Desechable Pack 3', 'eid-086-encendedor-de-piedra-desechable-pack-3', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"unidad_venta","nombre":"Unidad de venta","valor":"UNIDAD","unidad":null}]},{"grupo":"Dimensiones unidad de venta","filas":[{"clave":"alto","nombre":"Alto","valor":15.5,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":10.1,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":1.5,"unidad":"cm"}]},{"grupo":"Dimensiones caja","filas":[{"clave":"alto","nombre":"Alto","valor":35.4,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":34.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":54.5,"unidad":"cm"}]},{"grupo":"Logística","filas":[{"clave":"unidades_por_caja","nombre":"Unidades por caja","valor":240,"unidad":null},{"clave":"peso_caja_kg","nombre":"Peso caja","valor":15.8,"unidad":null},{"clave":"cajas_por_manto","nombre":"Cajas por manto","valor":5,"unidad":null},{"clave":"cajas_por_palet","nombre":"Cajas por palet","valor":20,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000093', 'EID-087', 'Encendedor Bbq Midi Xhg8869S Blister', 'eid-087-encendedor-bbq-midi-xhg8869s-blister', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"unidad_venta","nombre":"Unidad de venta","valor":"UNIDAD","unidad":null}]},{"grupo":"Dimensiones unidad de venta","filas":[{"clave":"alto","nombre":"Alto","valor":27,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":6.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":2,"unidad":"cm"}]},{"grupo":"Dimensiones caja","filas":[{"clave":"alto","nombre":"Alto","valor":29.8,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":44.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":52.7,"unidad":"cm"}]},{"grupo":"Logística","filas":[{"clave":"unidades_por_caja","nombre":"Unidades por caja","valor":144,"unidad":null},{"clave":"peso_caja_kg","nombre":"Peso caja","valor":9.8,"unidad":null},{"clave":"cajas_por_manto","nombre":"Cajas por manto","valor":4,"unidad":null},{"clave":"cajas_por_palet","nombre":"Cajas por palet","valor":16,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000094', 'EID-088', 'Encendedor Bbq Maxi Jw318 Blister', 'eid-088-encendedor-bbq-maxi-jw318-blister', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"unidad_venta","nombre":"Unidad de venta","valor":"UNIDAD","unidad":null}]},{"grupo":"Dimensiones unidad de venta","filas":[{"clave":"alto","nombre":"Alto","valor":31,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":7.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":2,"unidad":"cm"}]},{"grupo":"Dimensiones caja","filas":[{"clave":"alto","nombre":"Alto","valor":34.8,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":36.4,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":52.3,"unidad":"cm"}]},{"grupo":"Logística","filas":[{"clave":"unidades_por_caja","nombre":"Unidades por caja","valor":72,"unidad":null},{"clave":"peso_caja_kg","nombre":"Peso caja","valor":7.2,"unidad":null},{"clave":"cajas_por_manto","nombre":"Cajas por manto","valor":6,"unidad":null},{"clave":"cajas_por_palet","nombre":"Cajas por palet","valor":24,"unidad":null}]}]'::jsonb),
('f2000000-0000-4000-8000-000000000095', 'EID-089', 'Soplete Chef Encend Jet Flame Hc707', 'eid-089-soplete-chef-encend-jet-flame-hc707', NULL, 'b1000000-0000-4000-8000-000000000004', NULL, NULL, NULL, FALSE, TRUE, '91000000-0000-4000-8000-000000000004', '[{"grupo":"Datos generales","filas":[{"clave":"unidad_venta","nombre":"Unidad de venta","valor":"UNIDAD","unidad":null}]},{"grupo":"Dimensiones unidad de venta","filas":[{"clave":"alto","nombre":"Alto","valor":17,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":11,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":4,"unidad":"cm"}]},{"grupo":"Dimensiones caja","filas":[{"clave":"alto","nombre":"Alto","valor":37,"unidad":"cm"},{"clave":"ancho","nombre":"Ancho","valor":39.5,"unidad":"cm"},{"clave":"largo","nombre":"Largo","valor":47,"unidad":"cm"}]},{"grupo":"Logística","filas":[{"clave":"unidades_por_caja","nombre":"Unidades por caja","valor":96,"unidad":null},{"clave":"peso_caja_kg","nombre":"Peso caja","valor":12,"unidad":null},{"clave":"cajas_por_manto","nombre":"Cajas por manto","valor":6,"unidad":null},{"clave":"cajas_por_palet","nombre":"Cajas por palet","valor":36,"unidad":null}]}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Categorías (gama) por producto Eider.
INSERT INTO producto_categoria (producto_id, categoria_id) VALUES
('f2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000010', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000012', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000013', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000014', 'c1000000-0000-4000-8000-000000000011'),
('f2000000-0000-4000-8000-000000000015', 'c1000000-0000-4000-8000-000000000012'),
('f2000000-0000-4000-8000-000000000016', 'c1000000-0000-4000-8000-000000000012'),
('f2000000-0000-4000-8000-000000000017', 'c1000000-0000-4000-8000-000000000012'),
('f2000000-0000-4000-8000-000000000018', 'c1000000-0000-4000-8000-000000000012'),
('f2000000-0000-4000-8000-000000000019', 'c1000000-0000-4000-8000-000000000012'),
('f2000000-0000-4000-8000-000000000020', 'c1000000-0000-4000-8000-000000000012'),
('f2000000-0000-4000-8000-000000000021', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000022', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000023', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000024', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000025', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000026', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000027', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000028', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000029', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000030', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000031', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000032', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000033', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000034', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000035', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000036', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000037', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000038', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000039', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000040', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000041', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000042', 'c1000000-0000-4000-8000-000000000013'),
('f2000000-0000-4000-8000-000000000043', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000044', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000045', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000046', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000047', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000048', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000049', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000050', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000051', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000052', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000053', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000054', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000055', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000056', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000057', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000058', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000059', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000060', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000061', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000062', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000063', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000064', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000065', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000066', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000067', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000068', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000069', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000070', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000071', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000072', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000073', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000074', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000075', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000076', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000077', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000078', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000079', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000080', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000081', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000082', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000083', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000084', 'c1000000-0000-4000-8000-000000000014'),
('f2000000-0000-4000-8000-000000000085', 'c1000000-0000-4000-8000-000000000015'),
('f2000000-0000-4000-8000-000000000086', 'c1000000-0000-4000-8000-000000000015'),
('f2000000-0000-4000-8000-000000000087', 'c1000000-0000-4000-8000-000000000015'),
('f2000000-0000-4000-8000-000000000088', 'c1000000-0000-4000-8000-000000000015'),
('f2000000-0000-4000-8000-000000000089', 'c1000000-0000-4000-8000-000000000015'),
('f2000000-0000-4000-8000-000000000090', 'c1000000-0000-4000-8000-000000000015'),
('f2000000-0000-4000-8000-000000000091', 'c1000000-0000-4000-8000-000000000015'),
('f2000000-0000-4000-8000-000000000092', 'c1000000-0000-4000-8000-000000000015'),
('f2000000-0000-4000-8000-000000000093', 'c1000000-0000-4000-8000-000000000015'),
('f2000000-0000-4000-8000-000000000094', 'c1000000-0000-4000-8000-000000000015'),
('f2000000-0000-4000-8000-000000000095', 'c1000000-0000-4000-8000-000000000015')
ON CONFLICT (producto_id, categoria_id) WHERE borrado = FALSE DO NOTHING;

-- Precios base (SIN IVA) = precio Camión del PDF. Los productos con Camión
-- '-' no tienen precio base todavía (no aparecen en el catálogo hasta tenerlo).
-- RE-EJECUTABLE: ON CONFLICT sin target cubre la restricción EXCLUDE de
-- periodos solapados de producto_precios.
INSERT INTO producto_precios (producto_id, precio, fecha_inicio, creado_por) VALUES
('f2000000-0000-4000-8000-000000000001', 3.75, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000002', 3.75, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000003', 1.95, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000004', 2.37, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000005', 7.38, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000006', 1.70, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000007', 3.99, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000008', 7.81, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000009', 13.92, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000010', 2.24, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000011', 3.23, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000012', 4.06, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000013', 1.77, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000014', 3.83, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000015', 0.48, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000016', 1.31, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000017', 2.73, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000018', 1.66, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000019', 2.19, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000020', 10.29, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000021', 0.46, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000022', 1.20, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000023', 1.59, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000024', 1.92, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000025', 2.79, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000026', 2.29, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000027', 3.20, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000028', 0.46, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000029', 0.70, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000030', 2.82, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000031', 0.39, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000032', 1.57, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000033', 1.97, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000034', 1.97, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000035', 2.09, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000036', 3.83, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000040', 3.00, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000041', 5.24, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000042', 10.23, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000043', 0.35, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000044', 0.50, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000045', 0.67, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000046', 0.74, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000047', 0.36, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000048', 1.05, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000049', 1.78, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000050', 2.25, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000051', 0.57, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000052', 0.85, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000053', 1.08, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000054', 2.66, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000055', 3.38, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000056', 0.57, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000057', 1.31, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000062', 0.41, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000063', 0.62, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000064', 1.11, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000066', 1.51, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000067', 0.50, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000068', 1.12, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000069', 2.18, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000070', 4.23, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000071', 0.67, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000078', 1.44, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000079', 2.58, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000080', 0.88, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000081', 0.88, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000085', 0.31, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000086', 0.47, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000087', 0.41, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000088', 0.37, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000089', 0.38, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000090', 0.69, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000091', 0.73, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000092', 0.47, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000093', 0.62, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000094', 0.94, fn_hoy(), '11111111-1111-4111-8111-111111111111'),
('f2000000-0000-4000-8000-000000000095', 1.57, fn_hoy(), '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- Precios de transporte Eider (camión / palet / franquicia). Solo los valores
-- numéricos del PDF; '-' y 'Consultar' quedan sin fila.
INSERT INTO producto_precios_transporte (producto_id, transporte, precio) VALUES
-- Camión (= precio base)
('f2000000-0000-4000-8000-000000000001', 'camion', 3.75),
('f2000000-0000-4000-8000-000000000002', 'camion', 3.75),
('f2000000-0000-4000-8000-000000000003', 'camion', 1.95),
('f2000000-0000-4000-8000-000000000004', 'camion', 2.37),
('f2000000-0000-4000-8000-000000000005', 'camion', 7.38),
('f2000000-0000-4000-8000-000000000006', 'camion', 1.70),
('f2000000-0000-4000-8000-000000000007', 'camion', 3.99),
('f2000000-0000-4000-8000-000000000008', 'camion', 7.81),
('f2000000-0000-4000-8000-000000000009', 'camion', 13.92),
('f2000000-0000-4000-8000-000000000010', 'camion', 2.24),
('f2000000-0000-4000-8000-000000000011', 'camion', 3.23),
('f2000000-0000-4000-8000-000000000012', 'camion', 4.06),
('f2000000-0000-4000-8000-000000000013', 'camion', 1.77),
('f2000000-0000-4000-8000-000000000014', 'camion', 3.83),
('f2000000-0000-4000-8000-000000000015', 'camion', 0.48),
('f2000000-0000-4000-8000-000000000016', 'camion', 1.31),
('f2000000-0000-4000-8000-000000000017', 'camion', 2.73),
('f2000000-0000-4000-8000-000000000018', 'camion', 1.66),
('f2000000-0000-4000-8000-000000000019', 'camion', 2.19),
('f2000000-0000-4000-8000-000000000020', 'camion', 10.29),
('f2000000-0000-4000-8000-000000000021', 'camion', 0.46),
('f2000000-0000-4000-8000-000000000022', 'camion', 1.20),
('f2000000-0000-4000-8000-000000000023', 'camion', 1.59),
('f2000000-0000-4000-8000-000000000024', 'camion', 1.92),
('f2000000-0000-4000-8000-000000000025', 'camion', 2.79),
('f2000000-0000-4000-8000-000000000026', 'camion', 2.29),
('f2000000-0000-4000-8000-000000000027', 'camion', 3.20),
('f2000000-0000-4000-8000-000000000028', 'camion', 0.46),
('f2000000-0000-4000-8000-000000000029', 'camion', 0.70),
('f2000000-0000-4000-8000-000000000030', 'camion', 2.82),
('f2000000-0000-4000-8000-000000000031', 'camion', 0.39),
('f2000000-0000-4000-8000-000000000032', 'camion', 1.57),
('f2000000-0000-4000-8000-000000000033', 'camion', 1.97),
('f2000000-0000-4000-8000-000000000034', 'camion', 1.97),
('f2000000-0000-4000-8000-000000000035', 'camion', 2.09),
('f2000000-0000-4000-8000-000000000036', 'camion', 3.83),
('f2000000-0000-4000-8000-000000000040', 'camion', 3.00),
('f2000000-0000-4000-8000-000000000041', 'camion', 5.24),
('f2000000-0000-4000-8000-000000000042', 'camion', 10.23),
('f2000000-0000-4000-8000-000000000043', 'camion', 0.35),
('f2000000-0000-4000-8000-000000000044', 'camion', 0.50),
('f2000000-0000-4000-8000-000000000045', 'camion', 0.67),
('f2000000-0000-4000-8000-000000000046', 'camion', 0.74),
('f2000000-0000-4000-8000-000000000047', 'camion', 0.36),
('f2000000-0000-4000-8000-000000000048', 'camion', 1.05),
('f2000000-0000-4000-8000-000000000049', 'camion', 1.78),
('f2000000-0000-4000-8000-000000000050', 'camion', 2.25),
('f2000000-0000-4000-8000-000000000051', 'camion', 0.57),
('f2000000-0000-4000-8000-000000000052', 'camion', 0.85),
('f2000000-0000-4000-8000-000000000053', 'camion', 1.08),
('f2000000-0000-4000-8000-000000000054', 'camion', 2.66),
('f2000000-0000-4000-8000-000000000055', 'camion', 3.38),
('f2000000-0000-4000-8000-000000000056', 'camion', 0.57),
('f2000000-0000-4000-8000-000000000057', 'camion', 1.31),
('f2000000-0000-4000-8000-000000000062', 'camion', 0.41),
('f2000000-0000-4000-8000-000000000063', 'camion', 0.62),
('f2000000-0000-4000-8000-000000000064', 'camion', 1.11),
('f2000000-0000-4000-8000-000000000066', 'camion', 1.51),
('f2000000-0000-4000-8000-000000000067', 'camion', 0.50),
('f2000000-0000-4000-8000-000000000068', 'camion', 1.12),
('f2000000-0000-4000-8000-000000000069', 'camion', 2.18),
('f2000000-0000-4000-8000-000000000070', 'camion', 4.23),
('f2000000-0000-4000-8000-000000000071', 'camion', 0.67),
('f2000000-0000-4000-8000-000000000078', 'camion', 1.44),
('f2000000-0000-4000-8000-000000000079', 'camion', 2.58),
('f2000000-0000-4000-8000-000000000080', 'camion', 0.88),
('f2000000-0000-4000-8000-000000000081', 'camion', 0.88),
('f2000000-0000-4000-8000-000000000085', 'camion', 0.31),
('f2000000-0000-4000-8000-000000000086', 'camion', 0.47),
('f2000000-0000-4000-8000-000000000087', 'camion', 0.41),
('f2000000-0000-4000-8000-000000000088', 'camion', 0.37),
('f2000000-0000-4000-8000-000000000089', 'camion', 0.38),
('f2000000-0000-4000-8000-000000000090', 'camion', 0.69),
('f2000000-0000-4000-8000-000000000091', 'camion', 0.73),
('f2000000-0000-4000-8000-000000000092', 'camion', 0.47),
('f2000000-0000-4000-8000-000000000093', 'camion', 0.62),
('f2000000-0000-4000-8000-000000000094', 'camion', 0.94),
('f2000000-0000-4000-8000-000000000095', 'camion', 1.57),
-- Palet
('f2000000-0000-4000-8000-000000000003', 'palet', 2.49),
('f2000000-0000-4000-8000-000000000004', 'palet', 3.23),
('f2000000-0000-4000-8000-000000000005', 'palet', 10.62),
('f2000000-0000-4000-8000-000000000006', 'palet', 1.89),
('f2000000-0000-4000-8000-000000000007', 'palet', 5.19),
('f2000000-0000-4000-8000-000000000008', 'palet', 9.73),
('f2000000-0000-4000-8000-000000000009', 'palet', 18.03),
('f2000000-0000-4000-8000-000000000010', 'palet', 4.14),
('f2000000-0000-4000-8000-000000000011', 'palet', 5.84),
('f2000000-0000-4000-8000-000000000012', 'palet', 6.27),
('f2000000-0000-4000-8000-000000000013', 'palet', 1.93),
('f2000000-0000-4000-8000-000000000014', 'palet', 6.49),
('f2000000-0000-4000-8000-000000000015', 'palet', 0.57),
('f2000000-0000-4000-8000-000000000016', 'palet', 1.52),
('f2000000-0000-4000-8000-000000000017', 'palet', 3.02),
('f2000000-0000-4000-8000-000000000018', 'palet', 1.91),
('f2000000-0000-4000-8000-000000000019', 'palet', 2.59),
('f2000000-0000-4000-8000-000000000020', 'palet', 12.49),
('f2000000-0000-4000-8000-000000000021', 'palet', 0.52),
('f2000000-0000-4000-8000-000000000022', 'palet', 1.51),
('f2000000-0000-4000-8000-000000000023', 'palet', 1.93),
('f2000000-0000-4000-8000-000000000024', 'palet', 2.31),
('f2000000-0000-4000-8000-000000000025', 'palet', 3.37),
('f2000000-0000-4000-8000-000000000026', 'palet', 2.71),
('f2000000-0000-4000-8000-000000000027', 'palet', 3.65),
('f2000000-0000-4000-8000-000000000028', 'palet', 0.52),
('f2000000-0000-4000-8000-000000000029', 'palet', 0.78),
('f2000000-0000-4000-8000-000000000030', 'palet', 3.11),
('f2000000-0000-4000-8000-000000000031', 'palet', 0.44),
('f2000000-0000-4000-8000-000000000032', 'palet', 1.89),
('f2000000-0000-4000-8000-000000000033', 'palet', 2.23),
('f2000000-0000-4000-8000-000000000034', 'palet', 2.23),
('f2000000-0000-4000-8000-000000000035', 'palet', 2.35),
('f2000000-0000-4000-8000-000000000036', 'palet', 4.20),
('f2000000-0000-4000-8000-000000000040', 'palet', 3.61),
('f2000000-0000-4000-8000-000000000041', 'palet', 6.26),
('f2000000-0000-4000-8000-000000000042', 'palet', 12.27),
('f2000000-0000-4000-8000-000000000043', 'palet', 0.40),
('f2000000-0000-4000-8000-000000000044', 'palet', 0.57),
('f2000000-0000-4000-8000-000000000045', 'palet', 0.76),
('f2000000-0000-4000-8000-000000000046', 'palet', 0.84),
('f2000000-0000-4000-8000-000000000047', 'palet', 0.40),
('f2000000-0000-4000-8000-000000000048', 'palet', 1.27),
('f2000000-0000-4000-8000-000000000049', 'palet', 1.99),
('f2000000-0000-4000-8000-000000000050', 'palet', 2.54),
('f2000000-0000-4000-8000-000000000051', 'palet', 0.64),
('f2000000-0000-4000-8000-000000000052', 'palet', 0.98),
('f2000000-0000-4000-8000-000000000053', 'palet', 1.25),
('f2000000-0000-4000-8000-000000000054', 'palet', 3.02),
('f2000000-0000-4000-8000-000000000055', 'palet', 3.78),
('f2000000-0000-4000-8000-000000000056', 'palet', 0.66),
('f2000000-0000-4000-8000-000000000057', 'palet', 1.53),
('f2000000-0000-4000-8000-000000000062', 'palet', 0.47),
('f2000000-0000-4000-8000-000000000063', 'palet', 0.71),
('f2000000-0000-4000-8000-000000000064', 'palet', 1.22),
('f2000000-0000-4000-8000-000000000066', 'palet', 1.76),
('f2000000-0000-4000-8000-000000000067', 'palet', 0.56),
('f2000000-0000-4000-8000-000000000068', 'palet', 1.24),
('f2000000-0000-4000-8000-000000000069', 'palet', 2.40),
('f2000000-0000-4000-8000-000000000070', 'palet', 4.67),
('f2000000-0000-4000-8000-000000000071', 'palet', 0.77),
('f2000000-0000-4000-8000-000000000078', 'palet', 1.63),
('f2000000-0000-4000-8000-000000000079', 'palet', 2.86),
('f2000000-0000-4000-8000-000000000080', 'palet', 1.09),
('f2000000-0000-4000-8000-000000000081', 'palet', 1.09),
('f2000000-0000-4000-8000-000000000085', 'palet', 0.35),
('f2000000-0000-4000-8000-000000000086', 'palet', 0.54),
('f2000000-0000-4000-8000-000000000087', 'palet', 0.47),
('f2000000-0000-4000-8000-000000000088', 'palet', 0.41),
('f2000000-0000-4000-8000-000000000089', 'palet', 0.44),
('f2000000-0000-4000-8000-000000000090', 'palet', 0.75),
('f2000000-0000-4000-8000-000000000091', 'palet', 0.79),
('f2000000-0000-4000-8000-000000000092', 'palet', 0.52),
('f2000000-0000-4000-8000-000000000093', 'palet', 0.70),
('f2000000-0000-4000-8000-000000000094', 'palet', 1.05),
('f2000000-0000-4000-8000-000000000095', 'palet', 1.68),
-- Franquicia
('f2000000-0000-4000-8000-000000000015', 'franquicia', 0.63),
('f2000000-0000-4000-8000-000000000016', 'franquicia', 1.75),
('f2000000-0000-4000-8000-000000000017', 'franquicia', 3.47),
('f2000000-0000-4000-8000-000000000018', 'franquicia', 2.30),
('f2000000-0000-4000-8000-000000000019', 'franquicia', 2.98),
('f2000000-0000-4000-8000-000000000020', 'franquicia', 13.19),
('f2000000-0000-4000-8000-000000000021', 'franquicia', 0.65),
('f2000000-0000-4000-8000-000000000022', 'franquicia', 1.90),
('f2000000-0000-4000-8000-000000000023', 'franquicia', 2.27),
('f2000000-0000-4000-8000-000000000024', 'franquicia', 2.63),
('f2000000-0000-4000-8000-000000000025', 'franquicia', 3.57),
('f2000000-0000-4000-8000-000000000026', 'franquicia', 3.23),
('f2000000-0000-4000-8000-000000000027', 'franquicia', 4.22),
('f2000000-0000-4000-8000-000000000028', 'franquicia', 0.65),
('f2000000-0000-4000-8000-000000000029', 'franquicia', 0.97),
('f2000000-0000-4000-8000-000000000030', 'franquicia', 3.56),
('f2000000-0000-4000-8000-000000000031', 'franquicia', 0.67),
('f2000000-0000-4000-8000-000000000032', 'franquicia', 2.20),
('f2000000-0000-4000-8000-000000000033', 'franquicia', 2.64),
('f2000000-0000-4000-8000-000000000034', 'franquicia', 2.64),
('f2000000-0000-4000-8000-000000000035', 'franquicia', 2.77),
('f2000000-0000-4000-8000-000000000036', 'franquicia', 4.65),
('f2000000-0000-4000-8000-000000000040', 'franquicia', 9.18),
('f2000000-0000-4000-8000-000000000041', 'franquicia', 11.61),
('f2000000-0000-4000-8000-000000000042', 'franquicia', 17.04),
('f2000000-0000-4000-8000-000000000043', 'franquicia', 0.48),
('f2000000-0000-4000-8000-000000000044', 'franquicia', 0.71),
('f2000000-0000-4000-8000-000000000045', 'franquicia', 0.89),
('f2000000-0000-4000-8000-000000000046', 'franquicia', 0.97),
('f2000000-0000-4000-8000-000000000047', 'franquicia', 0.49),
('f2000000-0000-4000-8000-000000000048', 'franquicia', 1.64),
('f2000000-0000-4000-8000-000000000049', 'franquicia', 2.43),
('f2000000-0000-4000-8000-000000000050', 'franquicia', 2.94),
('f2000000-0000-4000-8000-000000000051', 'franquicia', 0.73),
('f2000000-0000-4000-8000-000000000052', 'franquicia', 1.12),
('f2000000-0000-4000-8000-000000000053', 'franquicia', 1.41),
('f2000000-0000-4000-8000-000000000054', 'franquicia', 3.38),
('f2000000-0000-4000-8000-000000000055', 'franquicia', 4.17),
('f2000000-0000-4000-8000-000000000056', 'franquicia', 0.76),
('f2000000-0000-4000-8000-000000000057', 'franquicia', 1.91),
('f2000000-0000-4000-8000-000000000062', 'franquicia', 0.64),
('f2000000-0000-4000-8000-000000000063', 'franquicia', 0.92),
('f2000000-0000-4000-8000-000000000064', 'franquicia', 1.70),
('f2000000-0000-4000-8000-000000000066', 'franquicia', 2.62),
('f2000000-0000-4000-8000-000000000067', 'franquicia', 0.79),
('f2000000-0000-4000-8000-000000000068', 'franquicia', 1.41),
('f2000000-0000-4000-8000-000000000069', 'franquicia', 2.74),
('f2000000-0000-4000-8000-000000000070', 'franquicia', 5.34),
('f2000000-0000-4000-8000-000000000071', 'franquicia', 0.98),
('f2000000-0000-4000-8000-000000000078', 'franquicia', 1.82),
('f2000000-0000-4000-8000-000000000079', 'franquicia', 3.30),
('f2000000-0000-4000-8000-000000000080', 'franquicia', 1.45),
('f2000000-0000-4000-8000-000000000081', 'franquicia', 1.45),
('f2000000-0000-4000-8000-000000000085', 'franquicia', 0.39),
('f2000000-0000-4000-8000-000000000086', 'franquicia', 0.66),
('f2000000-0000-4000-8000-000000000087', 'franquicia', 0.49),
('f2000000-0000-4000-8000-000000000088', 'franquicia', 0.43),
('f2000000-0000-4000-8000-000000000089', 'franquicia', 0.45),
('f2000000-0000-4000-8000-000000000090', 'franquicia', 0.77),
('f2000000-0000-4000-8000-000000000091', 'franquicia', 0.81),
('f2000000-0000-4000-8000-000000000092', 'franquicia', 0.54),
('f2000000-0000-4000-8000-000000000093', 'franquicia', 0.72),
('f2000000-0000-4000-8000-000000000094', 'franquicia', 1.11),
('f2000000-0000-4000-8000-000000000095', 'franquicia', 1.77)
ON CONFLICT (producto_id, transporte) WHERE borrado = FALSE DO NOTHING;
