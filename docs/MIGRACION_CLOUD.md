# Migración Supabase LOCAL → CLOUD

Cómo se migró el stack local al proyecto cloud `estufas`
(`bvulkrggcicftjalfctz`, región eu-west-1) el 2026-11-09, y cómo repetirla.

## Qué se hizo

1. **Schema**: las migraciones `0001`-`0026` se aplicaron en orden por la
   Management API de Supabase:
   `POST https://api.supabase.com/v1/projects/bvulkrggcicftjalfctz/database/query`
   con `Authorization: Bearer <access token>` y body `{"query": "<sql>"}`.
   El endpoint admite multi-statement y devuelve el resultado de la última
   sentencia (status 201 = OK; 400 = error con mensaje de Postgres).
2. **Datos**: dump local por tabla con `pg_dump --data-only --column-inserts`
   (docker exec sobre el contenedor local) y subida por la misma API en
   lotes de ~600 KB. `pg_dump` ya emite `OVERRIDING SYSTEM VALUE` para
   identidades y `setval` para secuencias. Los meta-comandos psql
   (`\restrict`) se eliminan antes de enviar.
3. **Ajustes de carga** (temporales, restaurados al final):
   - Los triggers de negocio se DESACTIVAN durante la carga (validaciones de
     comercial/pedidos, historial, asignación de comercial por defecto) para
     no bloquear datos legítimos fuera de orden.
   - `usuarios_id_comercial_fkey` se elimina y se recrea (el dump no va en
     orden de ids y la FK es circular).
   - El trigger `fn_handle_new_user` se neutraliza (no se puede hacer
     `DISABLE TRIGGER` sobre `auth.users` sin ser su dueño) y se restaura al
     final.
   - `categorias` y `comercial_proveedor` se vacían antes de cargar: las
     migraciones 0005 y 0020 ya insertan filas base.
4. **Funciones con search_path**: 11 funciones de trigger sin
   `SET search_path = public` fallaban en la sesión de la API (que no incluye
   `public`). Se parchearon en cloud con `CREATE OR REPLACE ... SET
   search_path = public`. ⚠️ Pendiente en el repo: añadir
   `SET search_path = public` a esas funciones en sus migraciones.

## Verificación (cloud vs local)

- usuarios 7/7, productos 1466/1466, pedidos 3/3, precios 1447/1447,
  auth.users 7/7, catalogo_version 10/10.
- Login admin@estufas.local OK (token 200).
- `fn_proveedores_visibles()` anónimo → Eider Biomasa + Fansa ✓.
- `fn_calcular_precio(LP-9, cliente 3333)` → 5 % `promocion_tienda`, 949.05
  — idéntico al local.

## Avisos

- 🔐 **Revoca el access token** de la Management API cuando termines la
  migración (Dashboard → Account → Access Tokens).
- Los datos son **demo** (usuarios de pruebas con contraseñas conocidas,
  catálogo real de proveedores): no publicar el proyecto sin limpiarlos.
- El APK de la beta apunta a este proyecto (ver `docs/PUBLICACION_BETA.md`).
- Cómo repetir: scripts en `.cli-home/` (`migrar.mjs`, `upload.mjs`,
  `verify.mjs`, `api.mjs`); regenerar los dumps locales con `pg_dump` y
  volver a ejecutar el upload (el preámbulo vuelve a truncar/recargar).
