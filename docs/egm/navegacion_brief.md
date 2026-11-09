# Navigation brief — inventory, observed problems, candidate patterns

Status: **pending user answers; do not launch Goldfish review.**

Date: 2026-11-09. Source: direct reading of the current code tree
(`src/app/**`, `src/shared/navegacion/**`, `src/features/catalogo/**`,
`src/shared/seguridad/**`) plus the user feedback recorded in
[docs/design/REQUISITOS_FICHA_CLIENTE.md](../design/REQUISITOS_FICHA_CLIENTE.md)
(review of 10/11/2026).

---

## 1. Current navigation inventory (from code, not assumptions)

### 1.1 What menus exist and where they render

**Bottom tab bar** — `src/shared/navegacion/nav-inferior.tsx` (`NavInferior`).

- Tabs are gated by capability (`usePermisos`): Catálogo
  (`catalogo:ver_general` OR `catalogo:ver_proveedores_propios`), Solicitud
  (`carrito:usar`), Pedidos (`pedidos:crear_propio` OR `pedidos:confirmar`),
  Cartera (`cartera:ver_clientes`, additionally hidden for the read-only
  admin), Admin (`admin:acceder`).
- Anonymous variant: Catálogo + Iniciar sesión.
- Solicitud shows a dot badge when the cart has lines.
- Rendered in exactly four screens: `catalogo-screen.tsx` (only with a
  session), `src/app/(carrito)/solicitud.tsx`, `src/app/(cliente)/pedidos/index.tsx`,
  `src/app/(comercial)/cartera/index.tsx`. It is **not** rendered in any
  `/admin` screen.

**Top header** — `src/features/catalogo/componentes/encabezado.tsx`
(`EncabezadoCatalogo`).

- Rendered only by the catalog screen
  (`src/features/catalogo/screens/catalogo-screen.tsx`).
- Contains: menu button (opens the drawer), brand, cart button (hidden for
  anonymous and for admin), "Para cliente" badge (when a target client is
  set), account button (hidden for admin; routes by role: comercial →
  `/cartera`, anything else → `/pedidos`).

**Drawer** — `src/features/catalogo/componentes/nav-lateral.tsx`
(`NavLateral`).

- Rendered only by the catalog screen.
- Contains: fuel sections (Pellets / Leña with sub-categories), a "General"
  section for fuel-agnostic categories, and a footer with the only account
  controls in the app: "Mi cuenta" (routes by capability: `admin:acceder` →
  `/admin`, `cartera:ver_clientes` → `/cartera`, else `/pedidos`) plus
  "Cerrar sesión" (local sign-out) when signed in, or "Iniciar sesión" when
  anonymous.

**Route groups and guards** — one `_layout.tsx` per group, all delegating to
`GuardRuta` (`src/shared/seguridad/guard-ruta.tsx`):

| Group | Guard | Routes |
|---|---|---|
| `src/app/(publico)/_layout.tsx` | `exige={[]}`, `exigeSesion={false}` | `/`, `/acceso`, `/registro`, `/catalogo/[id]`, `/catalogo/proveedor/[id]` |
| `src/app/(carrito)/_layout.tsx` | `exige={['carrito:usar','pedidos:crear_para_cliente']}`, `exigeSesion={false}` | `/solicitud` (anonymous can fill a cart; admin enters to build a client order) |
| `src/app/(cliente)/_layout.tsx` | `exige={['pedidos:crear_propio','pedidos:confirmar']}` | `/pedidos`, `/pedidos/[id]` |
| `src/app/(comercial)/_layout.tsx` | `exige='cartera:ver_clientes'` | `/cartera`, `/cartera/[id]` (comercial plus admin in read-only) |
| `src/app/(admin)/_layout.tsx` | `exige='admin:acceder'` | `/admin`, `/admin/comerciales`, `/admin/comerciales/[id]`, `/admin/proveedores`, `/admin/productos`, `/admin/promociones`, `/admin/usuarios` |

`src/app/dev/acceso.tsx` sits at the root without a group guard (dev-only
screen).

### 1.2 What disappears when entering Admin

- The top header and the drawer are catalog-screen components. No `/admin`
  screen renders either of them.
- The bottom tab bar is not rendered in `/admin` screens. An admin who taps
  the Admin tab lands on `src/app/(admin)/admin/index.tsx` with no tab bar,
  no drawer, no header account controls.
- `/admin` index shows a `ScreenHeader` with a back arrow
  (`volverA(respaldo='/')`) plus a text link "Volver al catálogo"
  (`router.replace('/')`).
- `/admin/comerciales` uses `ScreenHeader respaldo='/admin'`.
- `/admin/comerciales/[id]` uses `ScreenHeader respaldo='/admin/comerciales'`
  **and** renders a local bottom bar of its own
  (`PESTANAS_PREVIEW`, a `NavInferior`-style duplicate; the file comment says
  the duplication is intentional): Catálogo (navigates to `/`), Solicitud
  (disabled, no action), Pedidos and Cartera (local `seccion` state). This
  local submenu exists only in this screen.

### 1.3 How "back" works

- Screen headers use `ScreenHeader` (`src/shared/componentes/screen-header.tsx`)
  → `volverA(respaldo)` from `src/shared/lib/navegacion.ts`
  (`router.canGoBack() ? router.back() : router.replace(respaldo)`).
- Detail screens: `/pedidos/[id]` → `volverA('/pedidos')`; `/cartera/[id]` →
  `volverA('/cartera')`; `/admin/comerciales/[id]` →
  `volverA('/admin/comerciales')`; the other `/admin/*` screens →
  `volverA('/admin')`.
- `/admin` index has an explicit "Volver al catálogo" text link
  (`router.replace('/')`).

### 1.4 Where account access lives, per context

- **Catalog**: header account button (comercial → `/cartera`, cliente →
  `/pedidos`; hidden for admin; anonymous → `/acceso`) and the drawer footer
  (Mi cuenta + Cerrar sesión / Iniciar sesión).
- **`/solicitud`, `/pedidos`, `/cartera`**: no account controls, no logout,
  no drawer. Only the bottom tab bar. A user who wants to log out must go
  back to the catalog to open the drawer.
- **All `/admin` screens**: no account controls, no logout, no user
  information. Verified by search: "Cerrar sesión" / "Mi cuenta" / sign-out
  exist only in `nav-lateral.tsx` and `src/app/dev/acceso.tsx`.

### 1.5 Client fiche `/cartera/[id]` specifics

- `ScreenHeader` shows the client name (`razon_social` or full name) plus
  email · client type; `respaldo='/cartera'`.
- Body: primary CTA "Crear pedido para este cliente" (roles with
  `pedidos:crear_para_cliente`), a data card (CIF, email, phone — the code
  comment states the name is not repeated there because the header already
  shows it), discount management (general, per fuel, per provider via
  `DescuentosProveedor`), and the client's orders.

---

## 2. Concrete problems observed by the user

Source: review of `/admin/comerciales/[id]` and `/cartera/[id]` recorded in
[docs/design/REQUISITOS_FICHA_CLIENTE.md](../design/REQUISITOS_FICHA_CLIENTE.md)
(§A, §B and §D).

- **Two menus in parallel that do not take over from each other.** The
  catalog shows a top header, a drawer and a bottom tab bar at the same
  time; the drawer repeats fuel/category filters that also exist as chips in
  the screen. There is no single place that owns navigation.
- **Entering Admin removes BOTH.** No `/admin` screen renders the header,
  the drawer or the tab bar. Navigation inside admin is reduced to back
  arrows and one text link.
- **A local submenu appears inside `/admin/comerciales/[id]`.** A
  `NavInferior`-style bar is duplicated there with different semantics
  (Catálogo leaves the admin flow, Solicitud is disabled). It does not match
  any other admin screen.
- **In the whole admin flow there is no access to user information.** No
  account menu, no user identity, no logout anywhere under `/admin`.
- **The client name appears twice (header + body) in the fiche.** Recorded in
  `REQUISITOS_FICHA_CLIENTE.md` §B.5. Current code state: the body card
  already omits the name (header only), so this symptom is fixed in code but
  the requirement to keep it that way stands.
- **The "Tarifa Profesional" label is not understood.** Recorded in
  `REQUISITOS_FICHA_CLIENTE.md` §B.6 (remove it or replace it with the real
  client type, `particular` / `empresa`). Current code state: the string no
  longer appears anywhere in `src/` (verified by search), so this is a
  documentation-level requirement to keep the label out.

---

## 3. Candidate patterns (no choice made here)

For each option: what it solves, what it costs, what it breaks. No ranking,
no default. A persistent account menu (user info + logout reachable from
every screen) is a cross-cutting requirement that **any** option below must
include; it is not treated as a standalone option.

### Option A — Single app shell (persistent header + persistent tabs)

- **Solves:** menus stop disappearing between groups; account access is
  constant; admin keeps the same frame as the rest of the app.
- **Costs:** the header and drawer must move out of the catalog feature into
  shared code; per-screen `ScreenHeader` back arrows must coexist with a
  global header; every screen needs layout work.
- **Breaks:** catalog-only behaviors (provider-tinted primary, "Para
  cliente" badge, cart/account visibility rules) must be generalized or
  kept as per-screen overrides; the duplicated preview footer in
  `/admin/comerciales/[id]` must be deleted or replaced.

### Option B — Admin as a section inside the same shell

- **Solves:** one shell everywhere; admin has a visible home and the tabs
  stay meaningful inside admin.
- **Costs:** nested navigation state (admin stack inside a tab); deep links
  into `/admin/*` must define which tab is active; back behavior across the
  tab/stack boundary needs explicit rules.
- **Breaks:** the current standalone `(admin)` Stack group layout; the
  capability guards would move or split between the tab and the admin
  stack.

### Option C — Drawer instead of tabs (drawer becomes the global menu)

- **Solves:** one menu instead of two; the drawer already carries the
  account controls and logout.
- **Costs:** the drawer is catalog-specific today (fuel sections); bottom
  tabs are faster to reach on phones; all tab-specific logic (capability
  gating, active state, cart dot) must be rebuilt in the drawer.
- **Breaks:** `/solicitud`, `/pedidos` and `/cartera` currently have only
  tabs and no drawer — each of them would need the drawer or a header
  rework.

### Option D — "Back to the mode entry point" + breadcrumbs in admin

- **Solves:** admin navigation becomes legible (e.g. Admin / Comerciales /
  `<name>`); back always returns to the mode's entry point instead of an
  unrelated previous context.
- **Costs:** a breadcrumb component plus route metadata for every admin
  screen; this option alone does not solve the missing account access.
- **Breaks:** the current per-screen hardcoded `respaldo` values; a
  mode-root back policy changes deep-link behavior.

---

## 4. Open questions for the user

1. Should the bottom tab bar appear in admin screens at all, or should admin
   have its own navigation model?
2. Where should logout and user info live: a persistent header, the drawer,
   or a dedicated account screen reachable from every context?
3. Should the catalog drawer stay catalog-only (fuel filters) with a
   separate global menu added, or should the drawer become the global menu?
4. When an admin opens `/cartera/[id]` from a comercial preview, where should
   "back" land: the comercial preview (`/admin/comerciales/[id]`) or the
   admin home?
5. Is the "Catálogo" tab inside the admin comercial preview (which leaves
   the admin flow and opens the real catalog) desired, or should it be
   removed?

---

## 5. Readiness

**Pendiente de respuestas del usuario; no lanzar revisión Goldfish.**

All file paths cited in this brief were verified to exist on 2026-11-09.
Typecheck and lint do not apply to a documentation-only change.
