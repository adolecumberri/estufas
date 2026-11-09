# Matriz de navegación — rutas, tab bar, cabecera y "atrás" por identidad

Estado: **redactada desde el código verificado el 10/11/2026** (grep + lectura
directa de `src/app/**`, `src/shared/navegacion/**`,
`src/shared/seguridad/**`, `src/features/catalogo/**`). Los puntos que
dependían de una decisión del usuario quedaron **APROBADOS (10/11/2026)**;
la firma la registra el Lead en nombre del usuario.

Decisión de base (10/11/2026): una sola raíz de rutas compartidas
(`/pedidos`, `/cartera`, `/solicitud`, catálogo) y la zona de gestión del
admin en `/gestion` (antes `/admin`). El admin **opera** pedidos de clientes
(S0) y cada operación queda atribuida a quien la hizo (historial con actor,
`creado_por`). El admin reutiliza las rutas del comercial con alcance por
query `?comercial=<id>` — sin "modos" ni pantallas duplicadas.

## 1. Matriz por identidad

| Identidad | Rutas visibles | Tab bar | Cabecera (título / acciones / cuenta) | Capacidad requerida (guard) | "Atrás" (padre → volver, fallback) |
|---|---|---|---|---|---|
| **Anónimo** | `/`, `/catalogo/[id]`, `/catalogo/proveedor/[id]`, `/acceso`, `/registro`, `/solicitud` (carrito local), `/dev/acceso` (solo dev) | Catálogo · Iniciar sesión | Catálogo: `EncabezadoCatalogo` (menú, marca, carrito OCULTO, cuenta → `/acceso`). `/solicitud`: `ScreenHeader` "Solicitud" | `(publico)` exige `[]` sin sesión; `(carrito)` OR `[carrito:usar, pedidos:crear_para_cliente]` sin sesión (pasa por `carrito:usar`) | Catálogo = raíz (sin atrás). `/catalogo/[id]` → `volverA('/')`. `/solicitud` → `volverA('/')` |
| **Cliente** | las de anónimo + `/pedidos`, `/pedidos/[id]` | Catálogo · Solicitud · Pedidos | Catálogo: carrito visible, cuenta → `/pedidos`. `/pedidos`: `ScreenHeader` "Pedidos" (subtítulo email, acción Refresh). `/pedidos/[id]`: "Pedido nº X" + estado. `/solicitud`: "Solicitud" | `pedidos:ver` (grupo `(cliente)`); `carrito:usar`; `cuenta:ver_propia` | `/pedidos` → `volverA('/')`. `/pedidos/[id]` → `volverA(desde ?? '/pedidos')`. `/solicitud` → `volverA('/')` (edición: `/pedidos/<id>`) |
| **Comercial** | las de cliente + `/cartera`, `/cartera/[id]` | Catálogo · Solicitud · Pedidos · Cartera | Catálogo: cuenta → `/cartera`. `/cartera`: `ScreenHeader` "Cartera" (email, Refresh). `/cartera/[id]`: nombre del cliente (tipo) + CTA "Crear pedido para este cliente" | `cartera:ver_clientes`; `pedidos:confirmar`; `descuentos:gestionar`; `pedidos:crear_para_cliente` | `/cartera` → `volverA('/')`. `/cartera/[id]` → `volverA(desde ?? '/cartera')` |
| **Admin** | todo excepto carrito propio: `/`, `/catalogo/[id]`, `/catalogo/proveedor/[id]`, `/pedidos`, `/pedidos/[id]`, `/cartera`, `/cartera/[id]`, `/gestion`, `/gestion/comerciales`, `/gestion/comerciales/[id]`, `/gestion/proveedores`. `/solicitud` SOLO con cliente objetivo | Catálogo · Pedidos · Cartera · Gestión (sin Solicitud: no tiene `carrito:usar`) | Catálogo: carrito y cuenta OCULTOS. `/pedidos`: "Pedidos" (subtítulo "Admin · email"). `/gestion` y subpantallas: `ScreenHeader` + `AccionCuenta` (avatar: info + Mi cuenta → `/gestion` + Cerrar sesión). `/gestion/comerciales/[id]`: ficha-enlaces (Cartera / Pedidos / Catálogo del comercial) | `admin:acceder` (grupo `(gestion)`); `pedidos:ver` + `pedidos:confirmar`; `cartera:ver_clientes`; `descuentos:gestionar`. SIN `carrito:usar` ni `pedidos:crear_propio` | `/gestion` → `volverA('/')`. `/gestion/comerciales` → `volverA('/gestion')`. `/gestion/comerciales/[id]` → `volverA('/gestion/comerciales')`. `/gestion/proveedores` → `volverA('/gestion')`. `/pedidos` → `volverA('/')`. `/cartera` → `volverA('/')` |
| **Admin con `?comercial=<id>`** (caso especial) | `/cartera?comercial=<id>`, `/pedidos?comercial=<id>`, `/catalogo?comercial=<id>` — las MISMAS pantallas del comercial con el alcance fijado en la query (`useCartera`/`usePedidos` filtran por `id_comercial`/`comercial_id`; el catálogo limita los proveedores a los habilitados de ese comercial) | la del admin (Catálogo · Pedidos · Cartera · Gestión) | la normal de cada pantalla + banner de contexto "Viendo clientes de `<comercial>`" (o equivalente) en las rutas scoped — **APROBADO (10/11/2026)**; la firma la registra el Lead en nombre del usuario | las mismas del admin; cada operación queda atribuida al admin (historial con actor + `creado_por`) | "atrás" vuelve a `/gestion/comerciales/[id]` (padre del contexto); sin historial, fallback a esa misma ficha — **APROBADO (10/11/2026)**; la firma la registra el Lead en nombre del usuario |

## 2. Tab bar por capacidad (código `nav-inferior.tsx`)

- Catálogo → `catalogo:ver_general` O `catalogo:ver_proveedores_propios`
- Solicitud → `carrito:usar`
- Pedidos → `pedidos:crear_propio` O `pedidos:confirmar`
- Cartera → `cartera:ver_clientes`
- Gestión → `admin:acceder`
- Sin sesión: Catálogo + Iniciar sesión.

## 3. Reglas de "atrás"

- Todas las pantallas usan `ScreenHeader` → `volverA(respaldo)`
  (`router.canGoBack() ? router.back() : router.replace(respaldo)`); nunca
  `router.back()` suelto.
- El catálogo es la raíz y no tiene atrás; `volverA('/')` como fallback
  universal.
- `desde` (query) permite volver al flujo anterior (ficha del comercial).
  Decisión **APROBADA (10/11/2026)** — firma registrada por el Lead en nombre
  del usuario: en las rutas scoped (`?comercial=<id>`), "atrás" vuelve a
  `/gestion/comerciales/[id]` (padre del contexto); si no hay historial, el
  fallback es esa misma ficha.

## 4. Atribución de operaciones (S0, decisión 10/11/2026)

- `creado_por` = actor real en `crear_pedido`; `fn_pedido_historial` (0028)
  expone `actor_nombre`/`actor_rol` por cambio; el detalle del pedido lo
  muestra con `FilaDetalle` ("Creado por…" y "Por …" en el historial).
- El comercial ve las operaciones del admin sobre los pedidos de su cartera.

## 5. Rutas eliminadas (ya no existen)

- `/admin`, `/admin/comerciales`, `/admin/comerciales/[id]`,
  `/admin/proveedores` → renombradas a `/gestion/*`.
- `/admin/productos`, `/admin/promociones`, `/admin/usuarios` → borradas
  (huérfanas; sin enlaces ni pantallas).
