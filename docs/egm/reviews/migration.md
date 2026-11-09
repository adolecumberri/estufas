# EGM Goldfish review — navigation shell: migration, backward compatibility and long-term debt

Lens: **Migration & Backward Compatibility + Long-Term Tech Debt**.
Persona applied: `C:\Users\Usuario\.dsh\egm\agents\implementation_readiness.md`
(BRAINSTORM mode: migration, compatibility, rollout/rollback safety). There is no
dedicated migration persona in the agents directory; this is the closest match.
The persona is read-only; this report was written only because the delegated task
explicitly requires the file.

Date: 2026-11-09. Target: the one-paragraph proposal "single shell with mode
(admin / comercial / admin-viewing-as-commercial), tab set from mode data,
persistent header with account menu, helpdesk banner 'Viewing as <name>' + Exit,
drawer catalog-only, back = pop else mode root (removing hardcoded respaldo)".

Review basis note (Major, process): the input is not a design document.
`docs/egm/navegacion_brief.md` still says "pending user answers; do not launch
Goldfish review" (line 3 and §5) and lists five open questions (§4) that the
proposal only partially answers. No tab matrix, mode model, route map or scope
lifecycle exists anywhere. This review can judge the idea; it cannot certify a
plan that has not been written down.

---

## Verdict

**NOT READY. Do not implement this as described.** Five blockers, eight majors.

The direction is right: one frame, one account entry, one drawer, no per-screen
menus, and a visible "you are in a preview" banner are all improvements. But the
proposal is a navigation refactor disguised as a header/tab change. It crosses
the root navigator, the four-role capability cascade, the admin order flow and
the RLS-scope boundary, and it leaves every one of those decisions to the
implementer.

The two worst outcomes are both plausible with this text:

1. **Cosmetic shell.** The admin flow that motivates the work stays broken:
   admin opens "Crear pedido para este cliente", lands on an empty cart, and
   cannot add a product because the catalog and product screen hide "Añadir"
   for `perfil.rol === 'admin'`. The shell looks consistent while the main admin
   task is still impossible.
2. **Capability bypass.** The shell gives admin a comercial tab set and an
   "add" button, and the admin gains an own cart or commercial powers the cascade
   deliberately removed. `ARQUITECTURA_ROLES.md` is explicit: admin does not buy
   or order for itself and there is no impersonation. The server would reject
   the final order, but only after the UI has lied to the user.

If this ships as described, the repo will have a sixth navigation authority
(`mode`) next to capabilities, route guards, per-screen `respaldo`, the tab list
and the local `seccion` state in the admin preview. Long-term debt is not the
extra component; it is not knowing which of those six decides what.

What is worth keeping: catalog-only drawer, single account entry point,
persistent "Viewing as" banner concept, eventual deletion of the duplicated
preview footer, and a single data-driven tab definition.

---

## Findings

### F1 — [Blocker] "Persistent" shell placement is undefined, and the obvious implementation is not persistent

**Evidence.** `src/app/_layout.tsx` lines 22–27 document that the root layout is
outside the Stack and that `usePathname`/`useSegments` throw "Couldn't find a
navigation context" there. The only navigator in the root is `<Stack>` (line 38).
Each route group is its own Stack: `(publico)`, `(carrito)`, `(cliente)`,
`(comercial)`, `(admin)`. A shell rendered by each group `_layout` is therefore a
screen of the root Stack: crossing `/cartera/[id]` → `/solicitud`
(`cartera/[id].tsx:102`) or `/solicitud` → `/pedidos/[id]`
(`solicitud.tsx:116`) unmounts and remounts the whole shell, including the
"Viewing as" banner and the account menu. On native, the root Stack transition
animates the shell away.

A second placement problem: the catalog header currently inherits the provider
tint from `vars({ '--primary': ... })` applied on the catalog `Screen`
(`catalogo-screen.tsx:113–119`; header rendered at line 121). A shell header
rendered above the screen is outside that CSS-variable context and will use the
global green, not Eider/Fansa. The brief itself flags this in Option A
(`navegacion_brief.md:163–167`), but the proposal does not.

**Hazard.** The banner disappears exactly on the admin → client-fiche transition
it exists for; the account menu state resets; the catalog loses its provider
tint or has to duplicate the tint logic; and a "persistent" header is only
persistent within a group.

**Fix.** Choose and document one architecture before coding:

- **A. Truly persistent:** root/nested `Tabs` navigator with one Stack per tab,
  custom `tabBar` and header. This preserves tab/stack state, but requires
  restructuring `src/app` and changes back/tab semantics (see F6).
- **B. Consistent per-group shell:** wrap each group Stack; accept remounts and
  put all mode/scope state in a provider above the root Stack, deriving the
  banner from URL/context, not shell state. Do not promise "persistent" in the
  UI copy.

For the tint, either keep the header inside the catalog `Screen` (a per-screen
override) or pass the resolved provider color as props/style into the shell; do
not rely on `vars()` crossing a navigator boundary.

---

### F2 — [Blocker] The mode model is incomplete and conflates role with scope

**Evidence.** The app has four roles (`capacidades.ts:33`, `ORDEN =
['anon','cliente','comercial','admin']`). The proposal enumerates only
`admin / comercial / admin-viewing-as-commercial`: `cliente` and `anon` are
missing. Existing tab sets differ per role and per state:
`PESTANAS` (`nav-inferior.tsx:36–72`) has Catálogo/Solicitud/Pedidos/Cartera/Admin
gated by capabilities; `PESTANAS_ANONIMAS` (76–79) has Catálogo/Iniciar sesión;
admin's effective set is Catálogo + Admin because it lacks `carrito:usar` and
`soloLectura` hides Cartera (99–104). "admin-viewing-as-commercial" is not a
role; it is `admin` + a scope. There are also nested scopes already in use:
admin viewing a comercial (`/admin/comerciales/[id]`), admin viewing a client
(`/cartera/[id]`), and comercial preparing a client's order
(`clienteObjetivoId`).

**Hazard.** A flat enum cannot answer: which tabs, which is active on a nested
route, what "mode root" means, where Exit lands, whether Admin remains visible
while viewing as comercial, or what happens when the admin taps Catálogo. The
implementer will invent a different answer per screen.

**Fix.** Model `{ rol: Rol, scope: null | { tipo: 'comercial' | 'cliente', id: string } }`.
Derive tabs from `rol` + `scope` + current route; keep `anon` and `cliente`
explicit. Publish a matrix before coding, at minimum:

| rol / scope | Tabs |
|---|---|
| anon | Catálogo, Iniciar sesión (or no shell; decide) |
| cliente | Catálogo, Solicitud, Pedidos |
| comercial | Catálogo, Solicitud, Pedidos, Cartera |
| admin | Catálogo, Admin |
| admin + scope(comercial) | Catálogo, Cartera, Pedidos (scoped), Admin |
| admin + scope(cliente) | Catálogo, Solicitud (target), Pedidos (scoped), Admin |

Define the active-tab resolver for `/solicitud?editar` (Solicitud or Pedidos?),
`/cartera/[id]` (Cartera), `/admin/comerciales/[id]` (Admin), and the root
behavior of each tab.

---

### F3 — [Blocker] Capability precedence is undefined; "admin must not gain own cart" is currently enforced by role checks that also block the legitimate admin flow

**Evidence.** The cascade removes `carrito:usar`, `pedidos:crear_propio` and
`pedidos:confirmar` from admin, while keeping `pedidos:crear_para_cliente`,
`cartera:ver_clientes` and `descuentos:gestionar`
(`capacidades.ts:63–70`). `ARQUITECTURA_ROLES.md:71–72` says there is no
impersonation; 76–79 says admin does not buy/order for itself; but §4 line 99
says admin has `descuentos:gestionar` ❌ while `capacidades.ts:69` gives it ✅.
The UI gates by role, not only by capability:

- `tarjeta-producto.tsx:35–36` sets `esAdmin = perfil?.rol === 'admin'`; lines
  133 and 146 hide the stepper and the "Añadir" button for admin.
- `catalogo/[id].tsx:196–199` renders "Vista de administración: solo lectura"
  for admin instead of the add control.
- `encabezado.tsx:37–39` hides the cart for admin.
- `nav-inferior.tsx:49` hides Solicitud because admin lacks `carrito:usar`.
- `cartera/[id].tsx:98–103` shows the admin CTA "Crear pedido para este
  cliente" anyway.
- `contexto.tsx:263–271` blocks admin `anadir` without a target client;
  `0023_creador_pedidos.sql:55–61` rejects admin `crear_pedido` with
  `p_cliente_id = NULL`.

So today the admin can open a client's empty cart, but cannot add a single
product to it. The main use case ("open a client's order") is a dead end. A
shell that merely renders tabs does not fix it. A shell that makes admin "act
as comercial" fixes it but also re-exposes own cart/confirm unless every gate is
rewritten.

**Hazard.** Either the feature is still broken, or the mode layer overrides the
cascade and `admin must not gain own cart` becomes a UI convention instead of an
invariant. `usePermisos().soloLectura` is defined as `esAdmin`
(`use-permisos.ts:26–30`) and hides the Cartera tab (`nav-inferior.tsx:99–104`);
in "viewing as comercial" that hides the core screen, while the same admin can
edit discounts because `DescuentosProveedor` gates on `descuentos:gestionar`
(81) — so "solo lectura" is already false.

**Fix.** Keep `perfil.rol` authoritative for capabilities; make mode presentation
only. Replace the role checks with one pure predicate:

`puedeAnadirAlCarrito = puede('carrito:usar') || (puede('pedidos:crear_para_cliente') && !!clienteObjetivoId)`

Use it in `TarjetaProducto`, `ProductoDetalle`, `EncabezadoCatalogo` and the
Solicitud tab; keep the `contexto.tsx` guard and the RPC guard as defense in
depth. Do not grant admin `pedidos:confirmar` or `carrito:usar` for this feature.
Decide explicitly whether admin preview is read-only for discounts; make the
label match. If true impersonation is wanted, it is a separate project with
audit, RLS/RPC changes and pgTAP negatives, not a shell mode.

---

### F4 — [Blocker] The banner claims a scope that the data layer does not apply

**Evidence.** `useCartera` selects every `rol = 'cliente'` and relies on RLS
(`use-comercial.ts:25–30`); admin RLS reads all (`ARQUITECTURA_ROLES.md:133`).
`usePedidos` selects every visible order (`use-pedidos.ts:16–19`); admin sees
all. Only the admin comercial detail filters by comercial:
`useComercialDetalle` does `.eq('comercial_id', comercialId)`
(`use-admin.ts:406–413`). `resolverAlcanceCliente` lets admin open any client
(`alcance.ts:63–77`), and `/cartera/[id]` uses it. `cartera/index.tsx:158–162`
says "Vista de solo lectura del comercial", but the list is not that comercial's
list.

**Hazard.** The banner says "Viewing as Ana" while Cartera shows every client
and Pedidos every order. The admin can open a client from another comercial and
edit their discounts. That is not a security hole (RLS already lets admin read),
but it makes the banner false and destroys trust in the preview.

**Fix.** Add an optional `comercialId`/`clienteId` scope to `useCartera`,
`usePedidos` and `useCliente`/`resolverAlcanceCliente`. Filter client-side:
`id_comercial = scope.comercialId` for clients, `comercial_id = scope.comercialId`
for orders, `cliente.id_comercial = scope.comercialId` for the fiche. Show the
banner only when a scope exists; on a cold link derive the scope from the loaded
client (`cliente.id_comercial`) or hide the banner. Document that this is UX
scoping, not security, because admin RLS remains global; if enforcement is
required, add an RPC/RLS change and pgTAP negatives — do not pretend the UI
filter is the boundary.

---

### F5 — [Blocker] The `(cliente)` guard blocks admin, so the proposed "Pedidos" tab is dead on arrival and admin order creation ends in a redirect

**Evidence.** `src/app/(cliente)/_layout.tsx:10` requires
`['pedidos:crear_propio','pedidos:confirmar']`; admin has neither
(`capacidades.ts:65`), so `GuardRuta` redirects to
`INICIO_POR_ROL.admin = '/admin'` (`guard-ruta.tsx:40–45`;
`capacidades.ts:111–115`). `solicitud.tsx:116` does
`router.replace('/pedidos/${pedido_id}')` after creating an order.
`cartera/[id].tsx:392` links each client order to `/pedidos/[id]`.
`admin/comerciales/[id].tsx:214` links to `/cartera/[id]`. Therefore an admin who
creates a client order is bounced to `/admin` instead of the order detail, and
cannot open the client's orders from the fiche.

**Hazard.** The shell's "Pedidos" tab in admin-viewing mode will show a tab that
redirects to `/admin` (or to `/cartera`, depending on the mode resolver). This is
the most visible intermediate-state failure and it exists before the shell.

**Fix.** Before the shell, change the `(cliente)` guard to admit
`pedidos:crear_para_cliente` (admin and comercial) or add a separate
`(admin-preview)` group with its own guard. Ensure `pedidos/[id].tsx` gates
actions by capability, not `perfil.rol === 'comercial'` (line 54–56): admin must
not gain confirm/advance, but must be able to view the order it just created.
Add a manual test: admin → fiche → create order → lands on `/pedidos/[id]`, not
`/admin`.

---

### F6 — [Major] "Back = pop else mode root" regresses deep links and removes information the screens need

**Evidence.** `volverA` is `router.canGoBack() ? router.back() :
router.replace(respaldo)` (`shared/lib/navegacion.ts:6–13`). The current fallbacks
are not mode roots: `/admin` index uses `/` (`admin/index.tsx:32`), `/cartera`
uses `/` (`cartera/index.tsx:146`), `/pedidos` uses `/` (`pedidos/index.tsx:105`),
`/admin/comerciales` uses `/admin` (163–166), `/admin/comerciales/[id]` uses
`/admin/comerciales` (180–185), `/cartera/[id]` uses `/cartera` (111–118),
`/pedidos/[id]` uses `/pedidos` (161–164), `/solicitud?editar` uses
`/pedidos/{edit}` (122–124). "Mode root" is ambiguous:

- `/admin/comerciales/[id]` deep link → mode root `/admin` skips the list it
  belongs to.
- `/cartera` and `/pedidos` are themselves roots; `replace('/cartera')` or
  `replace('/pedidos')` is a no-op, leaving a back arrow that does nothing.
- `router.canGoBack()` is global, not per-stack. `NavInferior` uses
  `router.push` (line 120), so after a tab switch `canGoBack()` is true and
  "pop" lands on the previous tab, not the logical parent.
- In a Tabs navigator the same global `canGoBack` can be true because another
  tab has history.

**Hazard.** Removing `respaldo` makes deep links worse than today: wrong parent,
no-op back, or back to an unrelated tab. The design's "removing hardcoded
respaldo" is a cleanup that assumes a parent map exists; it does not.

**Fix.** Keep per-screen parent fallbacks (a route metadata map is fine:
`/admin/comerciales/[id] → /admin/comerciales`, `/cartera/[id] → /cartera`,
`/pedidos/[id] → /pedidos`, `/solicitud?editar → /pedidos/[id]`). Add a separate
`salirDelModo()` for the banner Exit, not for the header back arrow. Define tab
presses as replace/navigate, not push, or explicitly accept tab history. Hide the
back arrow on true tab roots (`atras={false}`) instead of rendering a no-op. Test
cold deep links with a fresh browser tab for every detail route.

---

### F7 — [Major] Duplicate-code deletion order will break the admin preview before its replacement exists

**Evidence.** `(admin)/admin/comerciales/[id].tsx:42–51` defines
`PESTANAS_PREVIEW`; 264–305 render a second tab bar. Its "Pedidos" section
(219–260) is the only place the admin sees that comercial's orders in context
(data from `useComercialDetalle`, filtered by `comercial_id` in `use-admin.ts`).
Its "Catálogo" tab leaves the admin flow (`router.push('/')`, 279–283);
"Solicitud" is disabled (285). The file comment says the duplication is
intentional. Account destinations are duplicated four ways:
`EncabezadoCatalogo.destinoCuenta` by role (24–33), `NavLateral.destinoCuenta` by
capability (52–56), `acceso.destinoPorRol` (25–29), and
`INICIO_POR_ROL` (`capacidades.ts:111–115`). `NavInferior` itself is imported by
four screens (`catalogo-screen:248`, `solicitud:270`, `pedidos/index:321`,
`cartera/index:185`).

**Hazard.** Delete the preview footer first and the admin loses the only scoped
order list. Delete the drawer account footer before the header menu has logout
and the user cannot log out from the catalog. Delete `nav-inferior.tsx` while
imports remain and the bundle breaks. The new shell then has five places that
decide "where does Mi cuenta go".

**Fix.** Order: (1) one pure `destinoCuenta(rol, caps, scope)`; (2) add the
scoped `/admin/comerciales/[id]` order view (or keep the local section until the
scoped `/pedidos?comercial=` exists); (3) add logout to the header menu; (4)
switch the four screens to the shell; (5) delete `PESTANAS_PREVIEW`; (6) delete
the drawer account footer; (7) only then delete `nav-inferior.tsx` after
`rg "NavInferior"` is empty. Keep the disabled/absent Solicitud semantics
explicit in the tab matrix; do not silently make it a real tab in admin mode.

---

### F8 — [Major] Moving the header/drawer to `shared` deepens an existing architecture violation

**Evidence.** `AGENTS.md` §1: `shared → features` is prohibited.
`shared/navegacion/nav-inferior.tsx:17–18` already imports
`@/features/carrito/contexto` and `@/features/auth/use-auth`;
`shared/seguridad/use-permisos.ts:3` imports `@/features/auth/use-auth`. The
brief's Option A says the header and drawer "must move out of the catalog
feature into shared code" (`navegacion_brief.md:163–167`). A stateful header in
`shared` that reads auth, cart, permissions and mode would add two more
violations.

**Hazard.** Reviewers cannot enforce the dependency rule; the shell becomes a
feature-aware god component in the layer that is supposed to be leaf-level.

**Fix.** Put the stateful shell in the app layer (`src/app/_components/shell/`)
or a `features/navegacion` container that receives `session`, `perfil`, cart
counts and callbacks via props/slots; keep the visual header/tab bar in
`shared/ui`/`shared/componentes` with no feature imports. If the team accepts
`shared → features` as an exception, write it in `AGENTS.md` and enforce one
direction; do not leave it implicit.

---

### F9 — [Major] Cold starts and session restore race the mode resolver and the guards

**Evidence.** `usePermisos` derives `rol` from `session ? perfil : null` and
falls back to `anon` while the profile is loading (`use-permisos.ts:19–20`).
`AuthProvider` starts with `session = null`, `loading = true` and fills both
asynchronously (`contexto.tsx:35, 47`). `GuardRuta` never checks `loading`
(`guard-ruta.tsx:31–45`). On a cold deep link to `/admin` or `/cartera`, the
guard can redirect to `/acceso` (no session yet) or to `/` (role still anon)
before the session is restored. The shell has the same problem: it may render
anonymous tabs for an admin for one or more frames, then flip to admin tabs and
show the banner late.

**Hazard.** Deep links are lost on refresh; mode/banner flicker; the admin deep
link may loop through login. A persistent shell makes this much more visible
than the current per-screen tabs.

**Fix.** Expose `loading` through `usePermisos`; `GuardRuta` should render a
splash/null while `loading` is true, before any redirect. The shell should not
derive mode/tabs until `perfil` is resolved. Test cold start on every protected
URL with a cleared session and with a restored session (web refresh + native
reload).

---

### F10 — [Major] Typecheck/typed routes are not a reliable gate for a route-file migration

**Evidence.** `app.json:37–39` enables `experiments.typedRoutes`. `.expo/` is
gitignored (`.gitignore` "Expo" block), so `.expo/types/router.d.ts` is local and
regenerated by the dev server. `AGENTS.md:74–75` says to run `npx expo start -c`
after moving files in `src/app` and wait ~40 s. The current generated file
contains a bogus route `/../features/catalogo/componentes/nav-lateral`, while
screens still carry escape hatches such as `router.replace('/' as never)`
(`catalogo-screen.tsx:162`) and `'/dev/acceso' as never` (`acceso.tsx:108`).
`npm run typecheck` passed at baseline on 2026-11-09, but that does not prove the
route table is correct.

**Hazard.** A route move can leave typecheck green against stale types or fail
only after regeneration; new `as never` casts hide broken links. `expo export`
does not regenerate typed routes. The migration's "typecheck gate" can be green
while navigation is wrong.

**Fix.** After every route-file move: `npx expo start -c`, wait for typegen,
inspect `.expo/types/router.d.ts` against the actual route files, then
`npm run typecheck`. Keep public URLs/filenames stable (groups are URL-invisible;
moving a file between groups is safe only if its pathname stays the same). Remove
`as never` where the route exists; if a cast remains, add a route-existence
check. Run `npm run verify` (Expo export android) as a bundle gate, not as a
route test.

---

### F11 — [Major] The pgTAP gate is documented with the wrong count and does not test the "admin own cart" invariant

**Evidence.** `AGENTS.md:69` and the Definition of Done (line 120) say pgTAP must
pass "63 asserts". The 12 test files declare `SELECT plan(...)` sums to **77**
(6+5+7+6+4+3+9+4+6+12+8+7). `10_roles_cascada.sql` tests admin creating an order
for a client (104–115), and client/comercial negatives (125–141), but there is no
test that admin with `p_cliente_id = NULL` throws. The shell migration is TSX-only
and should not need SQL, but the admin invariant it depends on is not pinned.

**Hazard.** A future `npx supabase test db` run reports 77/77 and someone treats
it as a mismatch with "63"; worse, a UI change that exposes an admin own-cart
path has no server-side test to catch it.

**Fix.** Update `AGENTS.md`/DoD to 77 or stop hardcoding the number. Add one
pgTAP assert: admin + `crear_pedido(NULL, ...)` throws "Cliente inválido para el
pedido" (and, if touched, admin cannot confirm). Run `npx supabase test db` at
baseline and after any SQL change; navigation-only phases can state "no SQL
touched" and skip it, but must say so in the report.

---

### F12 — [Major] The account menu does not exist, and the header/tab bar will collide with `ScreenHeader`, safe areas and bottom padding

**Evidence.** `src/shared/ui` has no menu/popover/dropdown primitive (badge,
button, card, chip, confirm-dialog, form-field, form-modal, icon-button, input,
label, separator, skeleton, stepper, text). The only menu is `NavLateral`'s
full-screen `Modal`. `ScreenHeader` (12–23) already renders a back arrow and
title on 13 call sites; `Screen`/`ScreenScroll` add `paddingTop: insets.top`
(`screen.tsx:27, 55`) and `ScreenScroll` adds only `paddingBottom: 32 +
insets.bottom` (53). `NavInferior` is `64 + insets.bottom` high
(`nav-inferior.tsx:110–111`). The catalog uses `paddingBottom: (session ? 88 :
24) + insets.bottom` (`catalogo-screen.tsx:196`); product detail has no extra
bottom padding (`catalogo/[id].tsx:112`); admin lists use the default
`ScreenScroll` padding.

**Hazard.** Two headers and two back arrows; a hand-built dropdown violating
"nothing Card/Modal/Header by hand" (`ARQUITECTURA_APP.md:41–46`); the last CTA
hidden behind the tab bar on product detail/login/admin lists; double top safe
area if the shell and `Screen` both apply it; provider tint lost (F1).

**Fix.** Define two header roles: a global app bar (brand, account menu, optional
back) and a page header (title/subtitle only, no duplicate back). Build the
account menu from existing primitives (`Modal`, `ConfirmDialog`, `Button`) or add
one shared menu primitive; no new dependency. Add a shell-aware bottom inset to
`Screen`/`ScreenScroll` (or a `ShellContent` wrapper) so every screen reserves
`64 + insets.bottom`; audit each screen at 320 px and 430 px. Move the top inset
to whichever layer actually owns the top edge; do not stack both.

---

### F13 — [Major] Scope lifecycle and persistence can leak or strand a client cart

**Evidence.** `SolicitudProvider` persists `{ carritos, clienteObjetivoId }` under
`STORAGE_KEYS.carritos` v2 (`contexto.tsx:33–37, 207–221`;
`constantes/index.ts:98–101`), sanitizes old blobs (156–170), and resets on
account change (138–150). `anadir` blocks admin without `clienteObjetivoId`
(266–271), but `reemplazar`/`quitar`/`cambiarCantidad` do not. The admin preview
sets `clienteObjetivoId` and `router.replace('/solicitud')`
(`cartera/[id].tsx:98–103`). If "Exit" only clears the mode and leaves
`clienteObjetivoId`, the admin remains in the client's cart and can keep adding
(or editing into it) after exiting. If the new mode/scope is persisted in the
same blob without optional fields, old blobs can break hydration; if the storage
key is versioned, users lose drafts.

**Hazard.** Stale target cart after Exit; scope leak across login/logout;
breakage for existing persisted carts; an admin "own cart" reached through
`reemplazar` on `/solicitud?editar`.

**Fix.** Do not persist mode; derive it from URL/context. If scope must persist,
add optional fields to `EstadoPersistido` under the same v2 key and sanitize
missing values; never drop the key. Exit must atomically clear mode + scope +
`clienteObjetivoId` (preserving the draft data if desired, but not as the active
bucket) and confirm if the draft has lines. Add the admin guard to `reemplazar`
or gate the edit flow by capability. Reset the new provider on `uid` change and
test logout → login as a different role.

---

## Rollout plan risks

### Safe order (if the project proceeds)

**Phase 0 — decisions and baseline (no code).** Update
`docs/egm/navegacion_brief.md` with the chosen decisions, the mode/scope model,
the tab matrix, the route→tab map, the back/parent map and the Exit semantics.
Run `npm run typecheck`, `npm run lint`, `npm run verify`, and (if the local
stack is up) `npx supabase test db`, recording real outputs. Capture the current
behavior matrix per role using `/dev/acceso` (8 profiles) and screenshots.

**Phase 1 — capability and flow fixes, no visual shell.** Add
`modos.ts`/`destinoCuenta`/`puedeAnadirAlCarrito`; add scope params to
`useCartera`/`usePedidos`/`useCliente`; fix the `(cliente)` guard and the admin
order redirect (F5); add the auth loading gate (F9); add the pgTAP admin
null-client assert. This phase is shippable on its own and fixes the actual
admin dead end. Keep the current UI.

**Phase 2 — admin shell only.** Wrap `(admin)` with the shell; keep
`ScreenHeader` for subpage titles; keep the preview footer until the scoped
Pedidos view has parity; then delete the footer (F7). Test `/admin`,
`/admin/comerciales`, `/admin/comerciales/[id]`, `/cartera/[id]`, `/pedidos/[id]`,
`/solicitud` (create → detail), and Exit.

**Phase 3 — comercial + client scope.** Wrap `(comercial)`; add the banner and
Exit; test the group-crossing chain `/admin/comerciales/[id]` → `/cartera/[id]` →
`/solicitud` → `/pedidos/[id]` with a refresh at each step. This is where the
scope provider is proven.

**Phase 4 — cliente/anónimo.** Decide whether anonymous, login/register and
product detail get the shell; if yes, add the bottom padding (F12) and test the
anonymous cart/login flow. If not, document why "single shell" excludes them.

**Phase 5 — deletion and cleanup.** Delete the old header, drawer account footer,
`PESTANAS_PREVIEW`, then `nav-inferior.tsx`; remove `respaldo` only after the
parent map and no-op checks are in place; update `AGENTS.md`,
`ARQUITECTURA_ROLES.md` and `ESTADO_APP.md`.

### What breaks while half-migrated

- Shell header + existing `ScreenHeader` → two headers, two back arrows, title
  duplication; do not render both on the same screen.
- Tabs on screens that assume no tab bar → last CTA hidden on product detail,
  login, admin index/lists (`ScreenScroll` only reserves 32 px).
- Preview footer deleted before scoped `/pedidos` exists → admin loses the
  contextual order list (the only scoped one).
- Admin "Pedidos" tab before the `(cliente)` guard fix → redirect to `/admin`.
- `soloLectura` still hides Cartera in admin-viewing mode → the core tab is
  missing.
- Banner implemented in shell state → disappears on `/cartera/[id]` (group
  crossing) and on refresh.
- `respaldo` removed before the parent map → no-op back on `/cartera` /
  `/pedidos`, wrong parent on `/admin/comerciales/[id]`.
- Tabs switched with `router.push` → history pollution; back returns to the
  previous tab; `canGoBack` becomes true for the wrong reasons.
- Route files moved before `npx expo start -c` → red typecheck or 404s; the
  old `as never` casts hide it.
- Logout/login in the shell → stale banner/scope and admin tabs flashing for an
  anonymous user; the mode provider must reset on `uid` change.
- Exit only clears mode → `clienteObjetivoId` stays active; admin keeps adding to
  the client's cart after "Exit".
- `NavInferior` deleted while any of the four screens still imports it → build
  break.

### Rollback safety

There is no schema migration in this feature; rollback is git revert. Keep each
phase a separate commit/PR with no unrelated work. Do not move route files and
change behavior in the same commit. If a Tabs restructure is chosen, prototype
the revert on a scratch branch before merging: restoring the old group layouts
and file tree is the expensive part, not the shell component. Keep public URLs
and filenames stable so old deep links survive. If the mode/scope is persisted,
version the blob and test an old `{ carritos, clienteObjetivoId }` payload.

---

## How to verify (real commands, not assumptions)

Baseline run on 2026-11-09 in this checkout:

- `npm run typecheck` → clean.
- `npm run lint` → 0 errors, 5 pre-existing warnings
  (`carrito/contexto.tsx:64` ×4, `catalogo/hooks/use-catalogo.ts:327`).
- `npx supabase test db` was not run (local stack not checked); the test plans
  sum to 77, so expect 77/77, not 63.

Per phase:

1. `npm run typecheck`, `npm run lint`, `npm run verify` (Expo export android).
2. `npx expo start -c` after any `src/app` file move; wait for typegen; inspect
   `.expo/types/router.d.ts` and the route files.
3. `npx supabase test db` only if SQL/RPC/RLS changed; add the admin
   null-client assert first.
4. Manual role matrix using `/dev/acceso`: anon, cliente, comercial, admin, and
   admin + each scope. For each route record: tabs visible, active tab, header
   (brand/account/back), cart icon/add button, banner, back fallback.
5. Cold deep links (fresh tab/refresh) for `/admin`, `/admin/comerciales/[id]`,
   `/cartera/[id]`, `/pedidos/[id]`, `/solicitud`, `/catalogo/[id]`; check for
   redirect loops, no-op back, wrong parent, missing banner.
6. History: tab switches should not grow the stack; Android hardware back from
   each tab root; browser back/forward; refresh preserves or explicitly clears
   the mode/banner.
7. Admin invariant: without a target client → no cart icon, no add, no Solicitud
   tab; with a target → add works, "Para cliente"/banner visible, cart badge
   counts the target; `crear_pedido(NULL, ...)` fails (pgTAP); create → lands on
   `/pedidos/[id]`; Exit clears target and banner without losing the draft data.
8. Width/safe-area: 320 px and 430 px; last CTA not covered by tabs; no double
   top inset; provider tint still applied in catalog.
9. Duplicate grep after deletion: `rg "PESTANAS_PREVIEW|Cerrar sesión|Mi cuenta|respaldo=|perfil\\?\\.rol === 'admin'|NavInferior" src`.

## What would change the verdict

Turn the five blockers into decisions: (1) choose Tabs vs per-group shell and
write it down; (2) replace the flat mode enum with `rol + scope` and publish the
tab/route matrix; (3) define the admin preview capability set and replace the
role checks with one predicate, keeping the server as the last line; (4) apply
the scope filter to every list/detail the banner covers, or drop the scope
claim; (5) fix the `(cliente)` guard and the admin order redirect. Add the
parent map and the three verification gates. With those, this becomes a normal
incremental refactor, not a capability gamble.
