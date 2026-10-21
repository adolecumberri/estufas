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
