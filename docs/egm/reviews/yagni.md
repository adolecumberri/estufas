# Goldfish review — navigation shell (YAGNI / cost lens)

Date: 2026-11-09 (review of the 10/11/2026 decision).
Snapshot: `ec4eca8` plus uncommitted work (`src/shared/navegacion/app-shell.tsx`
new, `src/app/(admin)/admin/comerciales/[id].tsx` and
`src/shared/lib/navegacion.ts` modified). `npm run typecheck` exits 0 at this
snapshot. Files were being edited while this review ran; line numbers refer to
the tree as read.

---

## Lens

Persona file read: `C:\Users\Usuario\.dsh\egm\agents\design_critic.md`. No
contrarian or YAGNI persona exists in that directory (the nine files are
bootstrap, codebase_details, comprehension, design_critic,
implementation_readiness, structural, style, synthesizer, zoom_out).
`design_critic.md` is the closest match: hostile design critic, architecture,
infrastructure economics, unmitigated risks. I apply it with the requested
contrarian / YAGNI / cost-economics lens: assume the feature is unnecessary
until the diff proves otherwise.

---

## Verdict

**Reject as scoped.** The shell is not a bad idea in the abstract; it is the
wrong unit of work. It builds a second navigation system (280 new lines, three
re-implemented components, three modes for one consumer) while the only bug the
user reported — the preview catalog showing the admin's catalog — is explicitly
deferred, and "operate as the comercial" is explicitly frozen at the current
capability set. The existing screens already do 80% of the target flow; the
missing 20% is two route parameters and one capability decision.

Cost ledger of the proposal as written: +280 lines of shared navigation, 3
duplicated components, 2 dead modes, 6+ screens to migrate, a new class of
layout regressions that typecheck cannot catch, and 0 of the user's reported
bugs fixed. The smallest version that meets the stated goal is ~4 files and
~50 lines.

---

## Findings

### 1. [Blocker] The first iteration cannot meet the stated goal, by its own design.

**Evidence.** Goal: "see and operate as that comercial: his orders, his
portfolio, and the ability to open orders for his clients"
(`docs/egm/navegacion_brief.md:214-216`). First iteration: preview tabs are
Solicitud / Pedidos / Cartera with the old read-only content
(`app-shell.tsx:60-64`; `(admin)/admin/comerciales/[id].tsx:193-259`). The
decision then says "Capabilities unchanged" (`navegacion_brief.md:272-274`).
The Cartera tab is the same client list that existed before the shell, and the
Pedidos tab is the same read-only row list with no actions (rows are plain
`View`s, `comerciales/[id].tsx:230-256`). Nothing the admin could not do before
the shell is now possible.

**Fix.** Decide what "operate" means before any shell work. If it means "open
orders and manage discounts", that is already legal and already built
(`cartera/[id].tsx:98-103,130-134`); stop there. If it means "confirm / advance
/ cancel pedidos", that is finding 7, not navigation.

### 2. [Blocker] The "preview/helpdesk mode" invents an authorization concept the system does not have, and the banner misstates the data.

**Evidence.** The role enum has three values, no support role
(`src/shared/seguridad/capacidades.ts:14`; `0001_init_schema.sql:75`). The only
occurrences of "helpdesk" in `src/` are the two comments introducing this
feature (`app-shell.tsx:32`, `comerciales/[id].tsx:44`). The architecture
explicitly says there is no impersonation (`docs/ARQUITECTURA_ROLES.md:71-72`).
Meanwhile the data layer is not scoped to the comercial: `useCartera()` selects
every `rol = 'cliente'` and relies on RLS
(`src/features/cartera/hooks/use-comercial.ts:22-37`), and RLS returns every
user to an admin (`0002_auth_rls.sql:177-183`). So a banner reading "Viendo
como <nombre>" would sit on top of the admin's full client base, not that
comercial's portfolio — a false statement about scope, in a system whose first
rule is that authorization lives in RLS/RPC and the UI never substitutes for
it.

**Fix.** Delete the mode, the banner and "Salir". Carry the comercial in the
URL (`/admin/comerciales/[id]` already carries it) and scope the list in the
query, as `useComercialDetalle` already does (`use-admin.ts:398-414`). If real
impersonation is ever wanted, it is a server feature with a scoped token, not a
UI mode.

### 3. [Blocker] `modo` duplicates the router, cannot survive a deep link, and is 2/3 unused.

**Evidence.** `modo` is a prop, not route state (`app-shell.tsx:82-101`); the
only consumer hardcodes `modo="preview"` (`comerciales/[id].tsx:165`); grep
finds one `AppShell` usage. `TABS_POR_MODO` declares `admin`, `comercial` and
`preview` (`app-shell.tsx:48-65`) — the first two are never referenced. `RAIZ_DEL_MODO`
(`app-shell.tsx:68-72`) encodes a back policy per mode that only one mode uses.
Deep-linking to `/cartera/<id>` from the preview loses the mode entirely, so it
is not a mode; it is per-screen state dressed as architecture.

**Fix.** Context belongs in the route: `/admin/comerciales/[id]/cartera`,
`/admin/comerciales/[id]/pedidos`, or `?desde=/admin/comerciales/<id>` on the
reused screens. Active tab derives from the pathname. Delete the mode type,
the tab table and the mode-root table.

### 4. [Blocker] The flow leaves the shell at the first real action, so "single shell" is false in practice.

**Evidence.**
- Preview "Cartera" card navigates to `/cartera/<id>` (`comerciales/[id].tsx:213`),
  a screen that renders its own `ScreenHeader` and no shell
  (`cartera/[id].tsx:8-9,110-119`).
- Preview "Solicitud" tab pushes `/solicitud` (`app-shell.tsx:61`), which
  renders its own `ScreenHeader` + `NavInferior` (`solicitud.tsx:10-11,121-122`)
  and has no client target when entered this way; its "Seleccionar" button
  sends the admin to `/cartera` (`solicitud.tsx:154-159`).
- Preview "Pedidos" rows are not pressable at all
  (`comerciales/[id].tsx:230-256`).

**Fix.** Do not wrap the list; nest the real fiche and the real pedido detail
under the preview route, or pass `desde` and reuse them. A shell that ends
where the work starts does not consolidate anything.

### 5. [Major] Duplication increases, not decreases.

**Evidence.** `app-shell.tsx` (280 lines) re-implements, almost line for line:
the tab bar (`app-shell.tsx:191-222` vs `nav-inferior.tsx:108-140`), the screen
header with back arrow (`app-shell.tsx:134-168` vs `screen-header.tsx:27-48`),
and the drawer's account block (`app-shell.tsx:224-277` vs
`nav-lateral.tsx:218-249`). It also adds a second back helper
(`navegacion.ts:16-26`) whose body is identical to `volverA`
(`navegacion.ts:6-13`). The original components stay in use on the catalog,
`/solicitud`, `/pedidos`, `/cartera` and `/admin` screens, so the app now has
two headers, two tab bars, two account menus and two back helpers. The design
brief sells "not duplicated JSX" (`navegacion_brief.md:219-223`); the tree shows
the opposite.

**Fix.** If a shared header/tab bar is wanted later, extract it once, migrate
all call sites in the same change, and delete the old ones. A half-migration is
a duplication increase, not a refactor.

### 6. [Major] The existing screens are not reused; their list bodies are copied again.

**Evidence.** The client list in the preview (`comerciales/[id].tsx:205-216`) is
a copy of `/cartera` (`cartera/index.tsx:171-181`), both using `TarjetaCliente`.
The pedido row in the preview (`comerciales/[id].tsx:230-256`) is a third copy
of the shape in `/pedidos` (`pedidos/index.tsx:268-313`) and
`/admin/comerciales/[id]` before the change. Reuse would have been a navigation
to the real screen plus a back parameter; the shell instead re-creates the
lists.

**Fix.** Extract `<ListaClientes>` / `<FilaPedido>` into the owning feature and
use them in both places, or navigate to the real screens. Prefer navigation;
it also gets the empty/error/loading states for free.

### 7. [Major] The capability model and the database disagree about the admin, and the shell inherits the disagreement.

**Evidence.** `pedidos:confirmar` is removed from the admin
(`capacidades.ts:63-66`) and the matrix marks it ❌ for admin
(`ARQUITECTURA_ROLES.md:96`). The RPCs allow the admin:
`confirmar_pedido` (`0003_rpc_funciones.sql:589-591`), `avanzar_pedido`
(`0003:631-633`), `cancelar_pedido` (`0003:543-547`), `ajustar_descuento_linea`
(`0003:683-684`). The UI hides the actions with role strings:
`puedeGestionar = esComercial` (`pedidos/[id].tsx:54-56`) and
`esComercialOAdmin = perfil?.rol === 'comercial'` (`pedidos/index.tsx:54`, a
variable whose name contradicts its body). The design says "capabilities
unchanged" (`navegacion_brief.md:272-274`), so a UI mode cannot unlock any of
this; the comparison never reaches the screen.

**Fix.** One product decision: can the admin transition pedidos? If yes, add
`pedidos:confirmar` to the admin's `anade`, update `ARQUITECTURA_ROLES.md` §4,
and replace the role-string checks with `puede()` — then the one existing
`/pedidos/[id]` screen works for the admin, no shell needed. If no, say so and
stop promising "operate as the comercial".

### 8. [Major] The only reported bug is deferred while the chrome is rebuilt.

**Evidence.** The user reported that the preview catalog showed the admin's
catalog, not the comercial's (`navegacion_brief.md:217-218`). The first
iteration removes the Catálogo tab and defers the scoped route
(`navegacion_brief.md:254-262`). The cheap fix already has a seam: the catalog
screen accepts a provider override (`catalogo-screen.tsx:45-49`) and the admin
can read `comercial_proveedor` (`0007_proveedores.sql:104`). Meanwhile the
shell (a much larger change) ships first. This is the priority inversion that
makes the design look like architecture for its own sake.

**Fix.** Do `/catalogo?comercial=<id>` first (one hook + one param + provider
selector limited to that comercial's providers). Measure. If that satisfies the
user, the shell loses its remaining justification.

### 9. [Major] Migration cost is real and invisible to typecheck.

**Evidence.** The one migrated screen had to drop its local footer and its
bottom padding reserve: `paddingBottom: 96 + insets.bottom`
(old `comerciales/[id].tsx:176`, footer at 264-305) became
`paddingBottom: 24` with no footer (current `comerciales/[id].tsx:184`,
`AppShell` at 164). Every other screen still reserves space for the old tab bar
or its own header: `pb-24` (`solicitud.tsx:121`, `pedidos/index.tsx:101`),
`88 + insets` (`catalogo-screen.tsx:196`), `32 + insets` (`screen.tsx:53`).
Each migration is a chance to leave content under a fixed bar or double the
gap, and `tsc` cannot see it. Six-plus screens are queued.

**Fix.** Do not start a migration pass. If one screen must change, change one
screen and keep the change local.

### 10. [Major] A global header cannot own the catalog, so the "single" header is already a second header.

**Evidence.** The catalog applies the provider tint through `vars()` on first
render specifically to avoid the NativeWind upgrade path that crashes when the
navigation context is serialized (`catalogo-screen.tsx:104-118`); the root
layout documents that route hooks cannot be used above the `Stack`
(`src/app/_layout.tsx`, comment on `ContenidoRaiz`). A shell header that lives
above screens cannot own the catalog's tint without moving `vars()` up and
re-opening that failure mode. The prototype avoids it by not touching the
catalog — which means the shell is used by one non-catalog screen while the
catalog keeps its own header. "Single" is not what was built.

**Fix.** Keep the catalog header catalog-only. A shared header for the other
sections is fine; it is not an app shell.

### 11. [Nit] "Drawer catalog-only" is the status quo, not a decision to implement.

**Evidence.** `NavLateral` is rendered only by the catalog screen
(`catalogo-screen.tsx:236-245`) and is constructed from catalog filter state
(`nav-lateral.tsx:21-40`). It cannot become global without exporting that state.
**Fix.** Record it as "unchanged"; no work.

### 12. [Nit] The account menu is a new primitive for a requirement that needs a button.

**Evidence.** `shared/ui` has no menu/popover/dropdown primitive (listing of
`src/shared/ui`: badge, button, card, chip, confirm-dialog, form-field,
form-modal, icon-button, input, label, separator, skeleton, stepper, text).
The shell's sheet (`app-shell.tsx:224-277`) duplicates the drawer's account
block (`nav-lateral.tsx:218-249`) and does not even pick a sign-out semantic
different from it (both use `signOut({ scope: 'local' })`, while
`AuthContext.signOut` uses the default; `contexto.tsx:96-97`).
**Fix.** If the requirement is "logout reachable from admin", put a `Cuenta`
action in `ScreenHeader`'s existing `accion` slot (`screen-header.tsx:12-24`,
~10 lines) and open the sheet only when a second consumer demands it.

### 13. [Nit] The brief sets its own gate and then bypasses it.

**Evidence.** `navegacion_brief.md:280-282`: do not launch the Goldfish review
until the shell is adopted and stable. At review time 1 of 6+ screens is
migrated and the file is untracked. This is a process signal: the design is
being reviewed for adoption before it has proved anything.
**Fix.** Either delete the gate or keep it. Reviews before adoption tend to
ratify the abstraction rather than test it.

---

## Smallest viable version

**Goal.** From `/admin/comerciales/[id]`, the admin can open a client, open an
order for that client, open a pedido, act on it if the product allows it, and
come back to that comercial — with account/logout reachable from admin.

**S0 — one decision, one sentence (no code).** Does "operate" include
confirm/advance/cancel pedidos?
- If no: the flow is navigation only; go to S1 and stop.
- If yes: add `pedidos:confirmar` to the admin's `anade`
  (`capacidades.ts:63-70`), update `ARQUITECTURA_ROLES.md` §4, and replace the
  role strings with `puede()` (`pedidos/[id].tsx:54-56`,
  `pedidos/index.tsx:54`). The `(cliente)` guard then admits the admin
  (`(cliente)/_layout.tsx:8-12`), and the existing detail screen does the rest.

**S1 — context by URL, not by mode (~4 lines, 2 files).**
- In `(admin)/admin/comerciales/[id].tsx`: client card →
  `/cartera/<id>?desde=/admin/comerciales/<id>`; pedido row gets `onPress` →
  `/pedidos/<id>?desde=/admin/comerciales/<id>`.
- In `cartera/[id].tsx` and `pedidos/[id].tsx`: read `desde` and pass it as
  `ScreenHeader`'s `respaldo` (default `/cartera` / `/pedidos`).
- Restore the `ScreenHeader` in the preview with the comercial's name and
  email. Delete the banner and "Salir": the header back arrow and the banner
  Exit both go to `/admin/comerciales` today (`app-shell.tsx:141` vs `:179`),
  so one of them is redundant, and the header already names the comercial.

**S2 — account access (~10 lines).** Add a `Cuenta` action to the `accion` slot
of `ScreenHeader` (email, Mi cuenta, Cerrar sesión with the drawer's local
sign-out semantics, `nav-lateral.tsx:61-69`). Mount it on the admin screens.
Do not build the bottom sheet yet.

**S3 — tab bar in admin (2 lines).** Render `<NavInferior activa="admin" />`
on `/admin` and `/admin/comerciales`. It already filters by capability and
yields Catálogo + Admin for the admin (`nav-inferior.tsx:97-106`). Do not add
Cartera/Pedidos to the admin tab set until finding 2's scoping is fixed.

**S4 — the reported bug (one route).** `/catalogo?comercial=<id>`: limit the
provider selector to that comercial's providers (`comercial_proveedor`,
`0007:104`) and pass the provider override the screen already supports
(`catalogo-screen.tsx:45-49`).

**Delete/defer.** `modo`, `TABS_POR_MODO`, `RAIZ_DEL_MODO`, the preview banner
and Exit, the preview tab data, `volverAlModo` (identical to `volverA`), the
global header migration, the drawer move, the extra modes, the second tab bar.

**Size.** 4-6 files, ~40-60 net lines, no new navigation model. If, after
this, the shell still looks necessary, it will be a one-screen-wide extraction
with a proven consumer — not a repo-wide abstraction with two dead modes.
