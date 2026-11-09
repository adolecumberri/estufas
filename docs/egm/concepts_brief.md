# Concepts brief — single-shell navigation for the estufas app

- **Author:** Worker (Goldfish consolidation, Team Lead)
- **Date:** 2026-11-10
- **Sources:** `docs/egm/navegacion_brief.md`, `docs/design/REQUISITOS_FICHA_CLIENTE.md`,
  `docs/egm/reviews/ux.md` (verdict: reject, 3 blockers), `docs/egm/reviews/yagni.md`
  (verdict: reject-as-scoped), `docs/egm/reviews/migration.md` (verdict: NOT READY,
  5 blockers, 8 majors).

## 1. Problem statement

A support (helpdesk) admin opening a commercial's client file must be able to
see that commercial's clients and orders, open a client's file, create an order
for that client, and get back to the commercial. Today this flow is broken:
navigation chrome (top header, drawer, bottom tabs) disappears entirely inside
`/admin`, the admin's preview bar in `/admin/comerciales/[id]` is a hand-made
duplicate with a disabled tab, the preview catalog showed the ADMIN's own
catalog instead of the commercial's, the admin can open a client's cart but
cannot add a single product to it (role checks hide the add control), and after
creating an order the admin is redirected to `/admin` because the `(cliente)`
group guard rejects the admin. There is no account/logout access anywhere in the
admin flow. The users hurt are: the admin doing support work (primary), and any
user who changes section and loses the menus (secondary).

## 2. What the user has already decided (10/11/2026)

These answers are recorded here as resolved decisions; they were previously only
verbal and one reviewer flagged that as a governance problem:

1. **Pattern A chosen:** one app shell with a "mode" instead of per-screen menus
   (Options B–D rejected: admin-as-tab-stack, drawer-as-global-menu, breadcrumbs).
2. **Helpdesk view of a commercial:** the admin sees and operates as that
   commercial: his orders, his portfolio, and the ability to open orders for his
   clients, with a persistent banner "Viendo como `<nombre>`" and a "Salir"
   action.
3. **Catalog bug in the preview:** the preview must show THAT commercial's
   catalog (his providers), never the admin's own catalog.
4. **Tabs:** tabs exist in admin too, derived from mode data, not duplicated
   JSX; in the preview the tabs are the commercial's tabs plus the banner.
5. **Account access:** a persistent header account button (avatar/initials)
   opens a menu/sheet with user info, mode switch where it applies, and logout;
   it must not depend on the drawer.
6. **Drawer:** catalog-only (it is fuel filters, not global navigation); later
   reframe as a "Filtros" panel.
7. **Back:** pop if there is history, otherwise the mode entry point; remove the
   hardcoded `respaldo` strings (reviewed and corrected in §4: the reviews found
   this rule inverted — see F-B3).
8. **Catálogo tab in the preview:** keep it WITHOUT leaving the mode (catalog
   renders inside the shell with the banner); if too costly for the first
   iteration, remove the tab temporarily instead of a tab that expels the flow
   (fallback already shipped: the Catálogo tab was removed from
   `PESTANAS_PREVIEW`).

## 3. Consolidated findings from the three reviewers

Deduplicated across `ux.md` (F1–F16), `yagni.md` (1–13) and `migration.md`
(F1–F13). Severity is the highest assigned by any reviewer. "Implication"
states what the corrected design must do about it.

### Blockers

| ID | Severity | Finding (sources) | Evidence (file:line) | Implication for the corrected design |
|---|---|---|---|---|
| F-B1 | Blocker | "mode" mixes identity with section and omits two roles; flat enum cannot answer tab/active/root/Exit questions (ux F1, mig F2, yagni 3) | `capacidades.ts:14,33,111-116` (five-role `INICIO_POR_ROL`), `app-shell.tsx:48-101` (unused `TABS_POR_MODO` admin/comercial) | Split the model: `identidad = {real: Rol, actuandoComo?}` + `seccion`; tabs = f(rol, scope, route); publish the matrix before code; no third vocabulary |
| F-B2 | Blocker | admin-as-comercial tab set is impossible under current capabilities, and the `(cliente)` guard bounces the admin; the helpdesk dead end is real (ux F2, mig F3/F5, yagni 1/7) | `capacidades.ts:59-71` (admin lacks `carrito:usar`, `pedidos:crear_propio`, `pedidos:confirmar`), `(cliente)/_layout.tsx:10`, `tarjeta-producto.tsx:35-36,133,146`, `catalogo/[id].tsx:196-199`, `pedidos/[id].tsx:54-56`, `contexto.tsx:263-271`, `0023_creador_pedidos.sql:55-61` | One product decision: can the admin operate orders (confirm/advance/cancel) or only read? Replace role-string checks with one predicate `puedeAnadirAlCarrito`; fix the `(cliente)` guard to admit `pedidos:crear_para_cliente`; never grant own-cart/confirm to admin |
| F-B3 | Blocker | "back = pop else mode root" is the inverse of what the stack does; tabs push, so pop silently switches modes; deep links get wrong parents (ux F3, mig F6) | `nav-inferior.tsx:118-121` (`router.push`), `navegacion.ts:6-13`, `screen-header.tsx:12-24`, `solicitud.tsx:124`, `admin/index.tsx:32` | Route metadata: every route has `parent` + `modeRoot`; tab press = replace, never push across modes; back arrow on roots = hidden; keep a parent map instead of deleting `respaldo` blind |
| F-B4 | Blocker | The banner claims a scope the data layer does not apply, and the first iteration cannot meet its own goal (yagni 1/2/4, mig F4, ux F2) | `use-comercial.ts:22-37` (all clients), `use-pedidos.ts:16-19` (all orders), `use-admin.ts:398-414` (only scoped reader), `cartera/index.tsx:158-162`, `app-shell.tsx:60-64` | "Operate as commercial" must be defined (see §5); scope = optional `comercialId`/`clienteId` params on `useCartera`/`usePedidos`/`useCliente`; banner only when a scope exists and the lists are actually scoped |
| F-B5 | Blocker | No mount point makes the shell persistent; root layout is outside the navigation context; per-group shells remount on every section change (mig F1, ux F4) | `src/app/_layout.tsx:22-38` (single Stack, documented no-nav-context), six group `_layout.tsx` | Choose and document: root `Tabs` with a Stack per tab, or a per-group shell + state provider above the Stack; mode/scope derived from URL, never from component state alone |

### Majors

| ID | Severity | Finding (sources) | Evidence (file:line) | Implication |
|---|---|---|---|---|
| F-M1 | Major | Persistent header cannot carry the provider tint without breaking the theme or leaking it (ux F5, yagni 10, mig F1) | `catalogo-screen.tsx:104-118` (first-render `vars()` requirement) | Shell header uses neutral tokens only; provider accent stays a catalog concern with an explicit store value for a header chip; keep the first-render rule in the design text |
| F-M2 | Major | Account controls would be duplicated again, with two disagreeing destinations, and there is no account screen to open (ux F6, yagni 12, mig F12) | `encabezado.tsx:24-39` (hides for admin), `nav-lateral.tsx:50-56,218-249`, `cuenta:ver_propia` unconsumed (`capacidades.ts:24,46`) | One capability-based `destinoCuenta(rol, caps, scope)`; one account menu spec (identity + Mi cuenta + Cerrar sesión + view-as-comercial); delete the drawer footer's account block in the same change |
| F-M3 | Major | "Viewing as" overlaps the existing target-client concept and has no exit state machine (ux F7, mig F13) | `encabezado.tsx:83-87` ("Para cliente"), `contexto.tsx:48,63,207-221` (`clienteObjetivoId` persisted), `cartera/[id].tsx:98-103` | One "acting as" slot; entry/exit defined in the document; Exit atomically clears mode + scope + `clienteObjetivoId` (draft data preserved, not active); banner is a live region with the consequence in words |
| F-M4 | Major | "Tab set from mode data" names no data; admin has 7 routes, 3 unreachable; 5-6 items do not fit a 64 px bar (ux F8) | `(admin)/admin/index.tsx:11-24`, `productos/promociones/usuarios` orphan routes, `nav-inferior.tsx:110-111` | Tab matrix with `mode × tab × route × cap`; overflow ("Más") above 4 tabs; decide the admin hub (page or delete) and the 3 orphan routes (link or remove) |
| F-M5 | Major | The stated problem "drawer repeats chips" is not true; the real parallel menus are header+drawer+bar and the duplicated preview bar (ux F9) | `selector-proveedor.tsx:78-117` (provider chips only), `nav-lateral.tsx:104-207` (fuel filters, no providers) | Correct the problem list: drawer = catalog filters only; delete the preview bar, not the fuel filters |
| F-M6 | Major | Bottom-bar spacing is four magic numbers and already broken; a shell must own the content viewport (ux F10, mig F12, yagni 9) | `catalogo-screen.tsx:196` (88), `[id].tsx:176` (96), `solicitud.tsx:121`/`pedidos/index.tsx:101` (`pb-24`), `screen.tsx:53` (32+insets), `cartera/index.tsx:142` (none) | One shell container subtracts header + bar + insets; screens stop passing bottom padding; acceptance check on the shortest screen |
| F-M7 | Major | Two stacked headers wherever `ScreenHeader` exists, plus double safe-area (ux F11, mig F12) | `cartera/[id].tsx:111-119`, `admin/index.tsx:32`, `screen.tsx:27` (`paddingTop: insets.top`) | One pattern: shell header carries back+title, `ScreenHeader` becomes a body section title (no arrow, no insets), or the inverse; update `Screen`/`ScreenScroll` in the same change |
| F-M8 | Major | Accessibility unspecified; current bar is the pattern that would be copied (ux F12) | `nav-inferior.tsx:116-137` (no roles/labels/selected), `[id].tsx:271-304` (disabled dead tab), `nav-lateral.tsx:71-79` (modal, no focus trap) | One tab primitive: `accessibilityRole="tab"`, `accessibilityState.selected`, labels, ≥44 px, web focus ring, no disabled tabs; banner as live region; in acceptance criteria, not polish |
| F-M9 | Major | Duplication increases, not decreases: the prototype re-implemented the tab bar, header and account block instead of extracting them (yagni 5/6, mig F7) | `app-shell.tsx:134-277` vs `screen-header.tsx:27-48`, `nav-inferior.tsx:108-140`, `nav-lateral.tsx:218-249`; `navegacion.ts:16-26` identical to `volverA` | Extract once, migrate all call sites in one change, delete old components; deletion order matters (scoped pedidos view before preview bar; logout in header before drawer footer; `NavInferior` last) |
| F-M10 | Major | The only reported bug (preview catalog showing the admin's catalog) is deferred while chrome is rebuilt — priority inversion (yagni 8) | `navegacion_brief.md:217-218,254-262`, `catalogo-screen.tsx:45-49` (provider override seam), `0007_proveedores.sql:104` | Do `/catalogo?comercial=<id>` first (provider selector limited to that commercial's providers); it is one hook + one param |
| F-M11 | Major | Moving header/drawer into `shared` deepens the existing `shared → features` violation (mig F8) | `nav-inferior.tsx:17-18` imports carrito/auth; `use-permisos.ts:3` imports auth; `AGENTS.md` §1 | Stateful shell in `src/app/_components/shell/` or a `features/navegacion` container receiving props; shared keeps only visual primitives with no feature imports |
| F-M12 | Major | Cold start races the mode resolver and the guards; `GuardRuta` never checks `loading` (mig F9) | `use-permisos.ts:19-20`, `contexto.tsx:35,47`, `guard-ruta.tsx:31-45` | Expose `loading` through `usePermisos`; `GuardRuta` renders a splash while loading; shell derives mode/tabs only after `perfil` resolves |
| F-M13 | Major | Typecheck/typed routes are not a reliable gate: `.expo/` is gitignored, the generated table already has a bogus route, `as never` casts hide broken links (mig F10) | `app.json:37-39`, `.gitignore` Expo block, `.expo/types/router.d.ts`, `catalogo-screen.tsx:162`, `acceso.tsx:108` | After every route move: `npx expo start -c`, wait for typegen, inspect the generated table against the real files; remove `as never` where the route exists; `npm run verify` as bundle gate |
| F-M14 | Major | pgTAP gate is documented with the wrong count (63) and the "admin own cart" invariant is not pinned (mig F11) | `AGENTS.md:69,120` (63), 12 test plans sum to 77, `10_roles_cascada.sql:104-141` | Fix AGENTS.md/DoD to 77 or stop hardcoding; add one pgTAP assert: admin `crear_pedido(NULL,…)` throws |
| F-M15 | Major | Exit that leaves `clienteObjetivoId` keeps the admin in the client's cart; `reemplazar`/`quitar`/`cambiarCantidad` skip the admin guard (mig F13) | `contexto.tsx:33-37,156-170,266-271` | Do not persist mode; Exit clears mode+scope+target atomically; add the admin guard to the edit methods; keep the v2 storage key with optional fields |

### Minors / nits (kept, not blockers)

| ID | Finding (sources) | Implication |
|---|---|---|
| F-N1 | English strings ("mode", "Viewing as", "Exit") in an es-ES product (ux F14) | Copy now: "Viendo como `<nombre>`", "Salir" / "Volver a administración"; one glossary: rol, capacidad, sección, modo |
| F-N2 | Sign-out is silent and swallows errors; no destination decision (ux F15) | Specify: confirmation, in-flight state, error message, destination, draft fate, mode reset |
| F-N3 | `activa` is a hand-passed literal that can lie; data-driven tabs can repeat it (ux F16) | Derive active tab from the pathname; table test per role: registry ↔ tab visibility ↔ group guards |
| F-N4 | The brief set its own review gate and the proposal bypassed it (yagni 13, ux F13) | Keep decisions recorded with date and owner in this brief; delete the "do not launch review" gate |
| F-N5 | Drawer catalog-only is the status quo, not work (yagni 11) | Record as "unchanged" |

## 4. Corrected design (proposed; replaces the half-shell prototype)

The prototype (`app-shell.tsx`, `volverAlModo`, mode enum, preview banner) is
deleted or rewritten. The work proceeds in five shippable phases, each with its
own verification; nothing is deleted before its replacement exists.

**F1 — Capabilities, scope and guards; no visual shell (ships the fix).**
Files: `src/shared/seguridad/capacidades.ts`, `src/shared/seguridad/use-permisos.ts`,
`src/shared/seguridad/guard-ruta.tsx`, `src/features/cartera/hooks/use-comercial.ts`,
`src/features/pedidos/hooks/use-pedidos.ts`, `src/features/cartera/hooks/use-cliente*`,
`src/shared/lib/alcance.ts`, `src/app/(cliente)/_layout.tsx`,
`supabase/tests/11_*` (one assert).
Work: one predicate `puedeAnadirAlCarrito = puede('carrito:usar') || (puede('pedidos:crear_para_cliente') && !!clienteObjetivoId)`
replacing the role-string checks in `TarjetaProducto`, `ProductoDetalle`,
`EncabezadoCatalogo` and the Solicitud tab; `(cliente)` guard admits
`pedidos:crear_para_cliente`; admin order create lands on `/pedidos/[id]`, not
`/admin`; optional `comercialId`/`clienteId` scope params on `useCartera`,
`usePedidos` and `useCliente` (UX scoping only; RLS stays the boundary); expose
`loading` and make `GuardRuta` wait; add the pgTAP admin null-client assert.

**F2 — Admin shell only.**
Files: new `src/app/_components/shell/` (or `features/navegacion`): shell,
header, account menu from existing primitives; `(admin)/_layout.tsx` and the
admin screens.
Work: wrap `(admin)`; header = brand + account menu + back (with the parent map
from F-B3); `ScreenHeader` degrades to a body title; account menu spec per
F-M2; keep `PESTANAS_PREVIEW` until the scoped pedidos view has parity, then
delete it.

**F3 — Comercial + scope (the helpdesk flow).**
Files: `(comercial)/_layout.tsx`, `cartera/*`, `pedidos/*`, `solicitud.tsx`,
`catalogo-screen.tsx` (scoped catalog), `contexto.tsx` (exit semantics).
Work: `/catalogo?comercial=<id>` scoped provider selector (F-M10, the reported
bug, done here or earlier); banner + "Salir" with the F-M3 state machine
(entry via `/admin/comerciales/[id]`, return target carried in the URL,
`?volver=…`); lists actually scoped by `comercialId`; Exit clears
mode+scope+`clienteObjetivoId` atomically; test the full chain
`/admin/comerciales/[id]` → `/cartera/[id]` → `/solicitud` → `/pedidos/[id]`
with a refresh at each step.

**F4 — Cliente / anónimo.**
Files: `(cliente)/_layout.tsx`, `(publico)/_layout.tsx`, `(carrito)/_layout.tsx`,
`Screen`/`ScreenScroll` (bottom inset, F-M6), product detail padding.
Work: decide whether anonymous, login/register and product detail get the shell;
if yes, apply the shell and the shared bottom inset; if no, document why
"single shell" excludes them. Audit 320 px and 430 px widths.

**F5 — Cleanup and fallback.**
Files: `nav-lateral.tsx` (account footer), `nav-inferior.tsx`, `screen-header.tsx`,
`navegacion.ts`, docs.
Work: after `rg "NavInferior"` is empty, delete the old tab bar; delete the
drawer account footer; delete `respaldo` only after the parent map and no-op
checks exist; update `AGENTS.md` (77 asserts), `ARQUITECTURA_ROLES.md`,
`ESTADO_APP.md`, `docs/FEATURES.md`.

Deleted across phases: `app-shell.tsx`, `volverAlModo`, the mode enum and
`TABS_POR_MODO`/`RAIZ_DEL_MODO`, the preview banner prototype, `PESTANAS_PREVIEW`,
the drawer account block, `NavInferior` (last), and the `as never` casts that
have a real route.

## 5. Open decisions that require the user

1. **Can the admin OPERATE pedidos (confirm / advance / cancel), or only read?**
   This is the single decision the reviewers could not make. If yes: add
   `pedidos:confirmar` to the admin's `anade` in `capacidades.ts`, update
   `ARQUITECTURA_ROLES.md` §4, replace role strings with `puede()` — and the
   existing `/pedidos/[id]` screen works for the admin. If no: the copy must
   stop promising "operate as the commercial" and the preview is read-only.
2. **The matrix is still pending.** `rol/identidad × sección × ruta ×
   capacidad × destino de back` must be completed by the user (or signed off)
   before F2. Draft rows already proposed in `migration.md` F2 (anon, cliente,
   comercial, admin, admin+scope(comercial), admin+scope(cliente)); the
   `/solicitud?editar` active-tab and root-per-tab behavior need answers.
3. **Scope of cartera/pedidos in admin-viewing-as-comercial.** Filter the
   lists client-side by `id_comercial = scope.comercialId` (UX-only, RLS stays
   global), or add server-side scoping (RPC/RLS change + pgTAP negatives)? And
   is the admin preview read-only for discounts (`descuentos:gestionar` is
   already granted) — the "solo lectura" label must match reality.
4. **Admin hub and the three orphan admin routes** (`productos`, `promociones`,
   `usuarios`): link them in the hub/menu or remove them.
5. **Anon/cliente in the shell** (F4): include or exclude, and why.

## 6. Risks and verification

Risks that stay open after this brief: cold deep links and refresh (session
restore vs guards and the mode resolver); back/history semantics across tab
replace and the Android hardware back (`BackHandler` not specified yet);
bottom padding and double safe-area on the shortest screens; provider tint
crossing the shell boundary; the absence of an admin's own cart must stay an
invariant (UI + context guard + RPC, tested); and `tsc` is NOT a navigation
gate — `.expo/types` is local and stale, `as never` casts hide broken links,
so every route move requires `npx expo start -c` + inspecting the generated
table; the pgTAP gate is 77 asserts (docs say 63).

Verification per phase: `npm run typecheck`, `npm run lint`, `npm run verify`
(Expo export android); after any `src/app` move: `npx expo start -c` and
inspect `.expo/types/router.d.ts`; `npx supabase test db` when SQL changes
(add the admin null-client assert first); the manual role matrix via
`/dev/acceso` (anon, cliente, comercial, admin, admin+each scope) recording
tabs, active tab, header, add button, banner, back fallback; cold deep links
in a fresh tab for every detail route; history checks (tab presses must not
grow the stack); and the final grep
`rg "PESTANAS_PREVIEW|Cerrar sesión|Mi cuenta|respaldo=|NavInferior" src`
returning empty in F5.
