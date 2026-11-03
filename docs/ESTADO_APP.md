# Estado funcional y de arquitectura — "Brasa y Verde" (estufas)

Documento de contexto: qué hace HOY la app, cómo está montada y qué queda
pendiente. Sirve de base para la corrección de procesos/arquitectura.

---

## 1. Qué es

Catálogo B2B **multi-proveedor** de estufas, combustibles y accesorios, con
gestión comercial: cada **comercial** atiende a sus **clientes**, asigna
condiciones (descuentos) y gestiona pedidos; el **admin** gestiona comerciales
y proveedores. La app es Expo (React Native + web), backend Supabase local.

Nombres: proyecto `estufas`, app "Brasa y Verde", UI en español.

---

## 2. Roles y acceso

| Rol | Qué puede hacer |
|---|---|
| **Anónimo** | Ver catálogo (eligiendo proveedor), buscar, fichas. Sin carrito ni "Añadir". |
| **Cliente** (`particular` / `empresa`) | Catálogo de los proveedores habilitados a su comercial, carrito propio, crear pedidos, ver sus pedidos. |
| **Comercial** | Catálogo de sus proveedores, cartera de SUS clientes, pedidos de su cartera, descuentos por cliente, crear pedidos para un cliente. También puede pedir para sí mismo (carrito propio). |
| **Admin** | SOLO lectura del catálogo (sin carrito) + panel: gestionar comerciales (crear, ver clientes/pedidos, accesos a proveedores) y proveedores (crear/editar, catálogo, icono/color). Sin cartera ni pedidos propios. |

- Registro público: **siempre crea cliente** (migración 0010 fuerza el rol; no
  se puede autoasignar admin desde los metadatos).
- Alta de comerciales: RPC `crear_comercial` (solo admin) que crea el usuario en
  `auth.users` + perfil con rol comercial.
- **Selector dev** (`/dev/acceso`, solo `__DEV__`): login de un toque con
  8 perfiles del seed (anónimo, admin, 3 comerciales, 3 clientes).

---

## 3. Catálogo

- **Un proveedor a la vez**: se elige con chips (selector) con icono y color;
  la elección se persiste por cuenta (`estufas.proveedor.v1.<uid|anon>`).
- **Tema**: el primario (`--primary`) de la app es verde `#415D43`; en la
  pantalla de catálogo se sustituye por el color del proveedor activo
  (Eider `#E1680F` ámbar/llama, Fansa `#6FC2B9` teal/flor).
- Buscador global (cruza combustibles), filtro por combustible
  (Pellets/Leña en el cajón lateral) y por categoría; sección "General" para
  categorías agnósticas (p. ej. Accesorios de Fansa).
- Rejilla de 2 columnas con paginación ("Cargar más"), tarjetas con imagen
  (o placeholder empaquetado), ref, precio final (con tachado del base si hay
  descuento), stepper y "Añadir" (solo con sesión).
- Ficha: origen, nombre, galería, ref, proveedor, marca/tipo, badges de
  categoría, cantidad+Añadir, precio, **precios por transporte**
  (Camión/Palet/Franquicia), **datos técnicos JSONB** por grupos
  (Datos generales, Dimensiones unidad/caja, Logística, etc.) y descripción.
- Ruta dedicada `/catalogo/proveedor/[id]`: misma pantalla forzando un
  proveedor (con banner "Viendo solo el catálogo de X").

## 4. Precios y descuentos

- Precio base por producto (`producto_precios`) + precios por transporte
  (`producto_precios_transporte`: camion/palet/franquicia).
- Descuentos por cliente: **general %**, **por producto**, **por combustible**
  y **promociones de tienda** (mejor promo).
- Precedencia: producto > combustible > general > promo (la promo gana si es
  mayor; no se acumulan). El 0% específico sustituye al general.
- Los precios del pedido se **congelan** en las líneas al crearlo; el servidor
  recalcula siempre al crear/editar (fuente de verdad).
- El comercial asigna condiciones desde la ficha del cliente (cartera).

## 5. Carrito y pedidos

- Carrito **local** (AsyncStorage, por cuenta) y **un borrador por cliente**
  cuando el comercial pide para un cliente; no se mezcla entre cuentas.
- **No se pueden mezclar proveedores** en un carrito: al intentarlo se muestra
  aviso y no se añade (el servidor también lo rechaza).
- Flujo: solicitud (carrito) → "Enviar pedido" → `crear_pedido` (valida
  proveedor único y habilitado, congela precios) → estados
  `solicitado → confirmado → en_preparación → completado` o `cancelado`.
- Cliente: ve y cancela sus solicitudes. Comercial: confirma pedidos de su
  cartera, edita líneas mientras esté "solicitado", ajusta descuentos.
- Pantalla Pedidos: filtros por estado con contadores, bloque "pendientes de
  confirmar" (comercial), historial. Detalle: miniaturas, cliente con "Ver
  ficha", líneas con descuentos, resumen B2B (portes bonificados), acciones e
  historial auditable.

## 6. Cartera (comercial)

- Lista de sus clientes (tarjeta con tipo, resumen de descuentos y nº pedidos).
- Ficha del cliente: datos, "Crear pedido para este cliente", **descuento
  general** (chips 5/10/15/20), **por combustible** (Pellets/Leña),
  **por producto** (buscador + %), historial de pedidos y nota de auditoría.

## 7. Administración

- Menú: **Comerciales** y **Proveedores** (Productos y Promociones retirados).
- **Comerciales**: tabla (nombre+email | proveedores con checkbox | nº clientes);
  botón + modal "Nuevo comercial"; clic en fila → vista previa del comercial
  (cartera de sus clientes con contadores de descuentos + pedidos), en solo
  lectura y con footer estilo app (Catálogo / Solicitud deshabilitada /
  Pedidos / Cartera).
- **Proveedores**: crear (modal), editar inline, icono (llama/flor) y color,
  "Ver catálogo" (ruta dedicada), badge activo; gestión activar/desactivar
  retirada (se hace en BD); accesos de comerciales se gestionan en Comerciales.
- El admin no tiene carrito ni añade nada: catálogo de solo lectura.

## 8. Backend (Supabase/Postgres)

- Stack local Docker (Kong 54321, Postgres 54322, Studio 54323); desde el móvil
  vía Tailscale `http://100.64.220.67:8450` (`.env.local`).
- **18 migraciones** (`0001`…`0019`, sin `0015`):
  - `0001` esquema base (usuarios/RLS-friendly, productos, precios, recursos,
    pedidos, líneas, historial, auditoría, triggers)
  - `0002` auth/RLS/triggers (perfil al registrarse, protección de campos)
  - `0003` RPCs (catálogo, ficha, precios, pedidos, estados)
  - `0004` precios, `0005` combustible (pellets/leña), `0006` descuentos por
    combustible + `fn_calcular_precio`
  - `0007` proveedores (tablas/RLS/RPCs admin/visibilidad/proveedor en pedidos)
  - `0008` fix CHECK origen `cliente_combustible`
  - `0009` datos JSONB + precios por transporte
  - `0010` registro seguro (rol cliente forzado)
  - `0011` proveedores solo admin + `fn_proveedores_visibles`
  - `0012` bloqueo `FOR SHARE` de productos en pedidos (concurrencia)
  - `0013` catálogo local: `catalogo_version` + triggers, `fn_catalogo_snapshot`,
    `fn_descuentos_cuenta`
  - `0014` solo 2 proveedores (Eider/Fansa), reasignación de estufas, RPC
    `crear_comercial`
  - `0016` catálogo filtrado por proveedor (`p_proveedor`)
  - `0017` icono por proveedor, `0018` color por proveedor,
    `0019` `fn_proveedores_visibles` con icono/color (anónimo ve todos)
- Catalogo local: `fn_catalogo_snapshot()` devuelve un JSON global (productos
  con precio base, transporte, datos, galería, combustibles, categorías) y
  `fn_catalogo_version()` (con término diario de frescura). `fn_descuentos_cuenta(p_cliente)`
  devuelve reglas de descuento + proveedores habilitados por cuenta.
- **Tests pgTAP**: 9 archivos (01…09), **51 asserts**, todos en verde
  (`npx supabase test db`).

## 9. Arquitectura de la app

- **Expo Router** (`src/app`): rutas `/` (catálogo), `/acceso`, `/registro`,
  `/solicitud`, `/pedidos`, `/pedidos/[id]`, `/cartera`, `/cartera/[id]`,
  `/catalogo/[id]`, `/catalogo/proveedor/[id]`, `/admin` (+ comerciales,
  comerciales/[id], proveedores, y pantallas heredadas usuarios/productos/
  promociones ya no enlazadas), `/dev/acceso`.
- **UI**: NativeWind v4 + kit tipo shadcn (`src/components/ui`), lucide con
  color explícito por tema (`useColoresIcono`), y `cssInterop` registrado para
  `expo-image` (sin él las imágenes no tenían tamaño).
- **Estado**: `AuthProvider`, `SolicitudProvider` (carritos + aviso proveedor),
  `ProveedorActivoProvider` (lista/selección persistida).
- **Datos**: todas las llamadas a backend en `src/hooks/*`; catálogo y ficha
  servidos desde **SQLite local** (`expo-sqlite`) con snapshot versionado y
  fallback al camino de red con caché SWR (`src/lib/cache.ts`); reglas de
  precio locales (`src/lib/precios.ts`) con la misma precedencia del servidor.
- **Helpers**: `imagenes.ts` (assets locales/placeholder), `colores-proveedor.ts`
  (tema desde HEX), `navegacion.ts` (`volverA` con respaldo), `format.ts`
  (EUR/fechas), `theme.ts` (colores de iconos y NAV_THEME), `interop-expo-image.ts`.
- **Tema dinámico**: variables CSS con `vars()` aplicadas **siempre** desde el
  primer render en la pantalla de catálogo (si se añadían después, NativeWind
  entraba en su warning y crasheaba serializando el contexto de navegación).

## 10. Datos de ejemplo (seed)

- Usuarios: admin, comercial, comercial Fansa, comercial Ambos, cliente,
  empresa, cliente sin comercial (`suelto@`), todos con contraseñas conocidas
  (ver `docs/USUARIOS_PRUEBA.md`).
- Proveedores: **Eider Biomasa** (llama, ámbar) y **Fansa** (flor, teal) →
  ~7 estufas del seed reasignadas a Eider + 95 productos Eider + 1.364 productos
  Fansa (macetería/jardinería, con precio base = PrecioTarifa); los productos
  sin foto usan el placeholder empaquetado.
- Categorías/gamas, marcas, descuentos de ejemplo (empresa 10% general, 0% en
  LP-9, promo 5%) y asignaciones comercial↔proveedor.

## 11. Limitaciones y deuda conocida

1. **PRs sin mergear**: #4 (`feat/proveedores`) y #5 (`feat/catalogo-local`,
   la actual). `main` va por detrás del trabajo. Orden de merge: #4 → #5.
2. **Descuentos por proveedor NO implementados**: decidido que cada cliente
   pueda tener condiciones por proveedor (general/combustible con
   `proveedor_id`, precedencia y RPCs). Hoy las reglas son por cliente,
   globales (`usuarios.descuento_porcentaje`, `descuentos_cliente_producto`,
   `descuentos_cliente_combustible`).
3. **"Por categoría técnica"** en la UI de cartera está mapeado a los descuentos
   **por combustible** (el modelo no tiene descuentos por categoría).
4. **Admin sin pedidos ni cartera** (por diseño actual); confirmar pedidos es
   tarea del comercial.
5. `0015` no existe (hueco de numeración); migraciones aplicadas solo al stack
   local.
6. El snapshot local necesita **una primera descarga con red**; sin snapshot y
   sin red se muestra error claro. La frescura añade término diario.
7. Sin CI, sin tests E2E ni de UI; cobertura backend por pgTAP. Aviso CodeRabbit
   de docstrings (~66%) pendiente.
8. Imágenes: assets locales para el seed; productos importados sin foto usan
   placeholder. En BD las URLs de `recursos` son de picsum (dev).
9. `expo-image` requiere el registro de interop (ya hecho) para respetar
   `className`.
10. En web el catálogo cae al camino de red (SQLite no disponible en el
    navegador sin wasm).
