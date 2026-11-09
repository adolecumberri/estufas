# Goldfish review — UX & Developer Ergonomics

## Lens

Persona: **EGM Design Critic** (`C:\Users\Usuario\.dsh\egm\agents\design_critic.md`).
No persona in `C:\Users\Usuario\.dsh\egm\agents\` covers UX or developer
ergonomics (`bootstrap_orchestrator`, `codebase_details`, `comprehension`,
`design_critic`, `implementation_readiness`, `structural`, `style`,
`synthesizer`, `zoom_out`). `design_critic` is the closest match (hostile
design critique, unmitigated risks), so its mandates and severity scale are
used, with the review lens widened to usability and implementation ergonomics.

Artifact under review: the proposed navigation design as stated for this review
(single app shell; a `mode` of admin / comercial / admin-viewing-as-commercial;
tab set derived from mode data; persistent header with account menu; drawer
only in catalog; helpdesk banner "Viewing as `<name>`" + Exit; back = pop else
mode root). It is not written down anywhere in the repository: the checked-in
documents are the pending-answers brief
`docs/egm/navegacion_brief.md` (status line 3: "do not launch Goldfish review",
line 223: "no lanzar revisión Goldfish") and the navigation section of
`docs/design/REQUISITOS_FICHA_CLIENTE.md` §D. The proposal was therefore
audited as a verbal design against the code it would change.

Read: `src/shared/navegacion/nav-inferior.tsx`,
`src/features/catalogo/screens/catalogo-screen.tsx`,
`src/features/catalogo/componentes/encabezado.tsx`,
`src/features/catalogo/componentes/nav-lateral.tsx`,
`src/features/catalogo/componentes/selector-proveedor.tsx`,
`src/app/(admin)/admin/comerciales/[id].tsx`,
`src/app/(admin)/admin/index.tsx`, the six `_layout.tsx` group layouts,
`src/app/(comercial)/cartera/[id].tsx`, `src/app/(comercial)/cartera/index.tsx`,
`src/app/(cliente)/pedidos/index.tsx`, `src/app/(carrito)/solicitud.tsx`,
`src/app/_layout.tsx`, `src/shared/seguridad/capacidades.ts`,
`src/shared/seguridad/guard-ruta.tsx`, `src/shared/seguridad/use-permisos.ts`,
`src/shared/componentes/screen.tsx`,
`src/shared/componentes/screen-header.tsx`,
`src/shared/lib/navegacion.ts`, `src/features/carrito/contexto.tsx`.

## Verdict

**reject**

The direction (one shell, one account entry point, no per-screen menu copies)
is right, but the proposal as stated cannot be implemented: two of its named
behaviours contradict the capability model and the navigation stack that exist
today (F1–F3), and three core decisions are left to the implementer (F4–F8).
It also freezes answers that the source brief explicitly deferred, without
recording the decision (governance issue, F13).

Conditions to re-submit for `accept-with-conditions`: a written mode/section
table (role × identity × section × route × capability × back target), a named
mount point for the shell, and one paragraph on the acting-as state machine
and its exit paths.

## Findings

### F1 — Blocker — "mode" mixes two axes and omits two roles

Evidence: the proposal names three modes (admin, comercial,
admin-viewing-as-commercial). The app has four roles (`capacidades.ts:14`,
`Orden` cascade lines 33–71) and navigation today already depends on two
independent things: **who you are** (rol/capabilities) and **where you are**
(section). The catalog is a section that all roles reach (`catalogo-screen.tsx`
mounted at `/`; anonymous tab set `nav-inferior.tsx:76-79`; "cliente" gets
Catálogo + Solicitud + Pedidos from `PESTANAS` lines 36–72). A fresh reader
cannot tell whether `anon` and `cliente` are modes, whether "catálogo" is a
mode, or which mode's tab list owns a screen like `/cartera/[id]` opened by an
admin. `INICIO_POR_ROL` (`capacidades.ts:111-116`) already encodes a different,
five-role notion of "mode root" (`comercial` → `/cartera`, not `/`), which
collides with the proposal's `mode` term.

Fix: split the model in two, and write it down:
`identidad = {real: Rol, actuandoComo?: 'comercial'}` and
`seccion = {catalogo, solicitud, pedidos, cartera, admin}`. A tab list is a
function of both, with one table in the document covering anon, cliente,
comercial, admin and admin-as-comercial. Do not introduce a third vocabulary
next to rol/capacidad without a glossary.

### F2 — Blocker — "admin viewing as comercial" cannot show the comercial's tabs, and hides the screen the helpdesk flow needs

Evidence: `capacidades.ts:59-71` removes `carrito:usar`, `pedidos:crear_propio`
and `pedidos:confirmar` from the admin. `nav-inferior.tsx:97-106` filters tabs
by capability, so an admin sees **no** Solicitud tab and **no** Pedidos tab
under today's logic. The `(cliente)` group guard requires
`pedidos:crear_propio` / `pedidos:confirmar` and redirects anyone else to the
role home (`guard-ruta.tsx:45`; `(cliente)/_layout.tsx`). So "viewing as
comercial" would render two of the comercial's four sections, and a tap on
Pedidos would silently bounce to `/admin`. Worse: the one screen where the
admin actually builds a client order is `/solicitud`, reached from the fiche
CTA (`cartera/[id].tsx:98-103`), and `carrito:usar` is exactly the capability
that hides it — the mode would omit the Helpdesk task it is named after.

Fix: decide explicitly which of these is true and write it: (a) the mode is
"ficha del comercial" and its tabs are Cartera (read-only) + Pedidos
(read-only), with the order CTA opening `/solicitud` as a pushed, non-tab
screen; or (b) impersonation grants a defined read-only capability set that
`guard-ruta` understands via an explicit `actuandoComo` flag. Never inject
impersonated capabilities into `capacidadesDe()` (that would make the client
the authority for UI gating and invite a write path the RLS denies). Add the
mode tables as a unit test asserting every tab's cap against its group guard.

### F3 — Blocker — "back = pop else mode root" is the opposite of what the stack does

Evidence: tabs navigate with `router.push` (`nav-inferior.tsx:118-121`), so
tapping Admin from `/cartera` pushes `/admin` onto the same root Stack
(`_layout.tsx`, single `Stack`). At `/admin` (the mode root) `canGoBack()` is
true, so "pop" wins and back returns to `/cartera` — a silent mode switch to
whatever tab was pressed before. The "else mode root" branch is effectively
unreachable: `volverA` only uses its fallback when there is no history at all
(`navegacion.ts:6-13`), which is the opposite rule. Android hardware back and
browser back (web is supported; `_layout.tsx` centers the app in a 430 px
column) are not covered by the proposal at all.

Fix: define back from route metadata: every route has `modeRoot` and `parent`.
Tab press → `router.replace`/reset (never push another mode), or push inside
one mode only. Back arrow on a mode root → no arrow (or `replace(modeRoot)`);
back on a non-root → `volverA(parent)`. Register the same function with
`BackHandler` for Android and state the web-history policy. Replace the
per-screen `respaldo` strings (`screen-header.tsx:12-24`, `[id].tsx:185`,
`solicitud.tsx:124`) with that metadata so the rule is testable.

### F4 — Major — there is no stated place to mount a truly persistent shell, and the obvious one is documented as broken

Evidence: `src/app/_layout.tsx` renders `<Stack>` inside `ContenidoRaiz` and
its comment states that the root layout sits outside the navigation context,
so `usePathname`/`useSegments` throw there ("Couldn't find a navigation
context") — the same constraint that forced the provider color into the
catalog screen (`catalogo-screen.tsx:104-118`). Each group layout owns its own
`Stack` (`(admin)/_layout.tsx`, `(publico)/_layout.tsx`, etc.), so a header/tab
bar placed in a group layout is unmounted and remounted whenever the group
changes, and would have to be duplicated per group — the exact duplication the
design claims to remove.

Fix: name the file and mechanism in the design. Viable: a `Shell` component
rendered **inside** the root Stack via a listener-driven navigation store
(updated from a child of the Stack), or per-group layouts consuming one shared
component with mode derived from a pathname→mode table. State how mode survives
a reload/deep link (`/cartera` typed directly, web refresh): derive it from the
URL, never from in-memory state only.

### F5 — Major — the persistent header cannot carry the provider-tinted primary without breaking the theme

Evidence: the catalog overrides `--primary` / `--primary-foreground` per active
provider on its own `Screen` (`catalogo-screen.tsx:113-118`), with an explicit
comment (lines 104–111) that the variables must exist on the first render or
NativeWind hits its upgrade path and crashes serializing the navigation
context. Hoisting the header into the shell moves it outside that `vars()`
scope: either the header stays green while the catalog body is Eider orange or
Fansa teal, or the shell sets the provider variables and leaks them into
`/admin`, `/cartera` and `/solicitud`.

Fix: state the rule: the shell header uses neutral tokens only; provider accent
is a catalog-screen concern, applied to the catalog's own content and to a
provider chip in the header fed by an explicit store value (not route hooks).
Keep the first-render requirement in the design text so the next implementer
does not re-introduce the crash.

### F6 — Major — account controls would be duplicated again, with two disagreeing destinations, and there is nothing to open

Evidence: the header decides the account destination by role and hides the
button for admins (`encabezado.tsx:24-39`); the drawer decides it by capability
and shows it to admins (`nav-lateral.tsx:50-56`: admin → `/admin`). Those two
rules already disagree. A persistent account menu must replace both, but the
proposal does not say so, and the drawer footer would remain a second account
entry point (`nav-lateral.tsx:218-249`). There is also no account destination
to put in the menu: `cuenta:ver_propia` exists (`capacidades.ts:24,46`) and
nothing consumes it; there is no `/cuenta` route (route listing: `src/app` has
no cuenta file). "Mi cuenta" currently means "go to my orders/cartera/admin".

Fix: one rule (capability-based, no role comparison), one account menu spec
(items: identity line — name + email + role/provider; "Mi cuenta"; "Cerrar
sesión"; and, for admins, the entry to "ver como comercial" if that survives),
and either add a real account screen or rename the item to what it does. Delete
the drawer footer's account block in the same change; otherwise the original
complaint ("two menus in parallel") survives.

### F7 — Major — the "Viewing as" banner overlaps an existing acting-as concept and has no exit state machine

Evidence: the app already has an acting-as signal — the "Para cliente" badge in
the header (`encabezado.tsx:83-87`) and the cart-level target client
`clienteObjetivoId`, persisted with the carts (`contexto.tsx:48,63,215`) and
consumed by `/solicitud` (`solicitud.tsx:138-165`) and the fiche CTA. The
proposal adds a third state ("viewing as `<comercial>`"). Undefined: what
exactly is simulated (the comercial's clients? their prices? the ability to
create orders?), what Exit restores when the admin arrived by
`router.push('/cartera/...')` from `/admin/comerciales/[id]` versus by a direct
link or a web reload, whether the banner survives a Catálogo tab press, whether
Exit clears the persisted `clienteObjetivoId` draft, and where the admin lands
after Exit.

Fix: one "acting as" slot in the header, never two banners. Define the state
machine in the document: entry points and their return target (carried in the
URL, e.g. `?volver=/admin/comerciales/<id>`), what the banner says (Spanish),
what Exit does (return target or `/admin`; keep or clear the draft), and what
happens on logout/session expiry. Make the banner a live region for screen
readers and give it a distinct treatment plus the consequence in words
("solo lectura" or "el pedido quedará a nombre de `<cliente>`"), because the
cost of a Helpdesk agent mistaking the identity is a wrong-client order.

### F8 — Major — "tab set derived from mode data" names no data, and the admin sections do not fit a bottom bar

Evidence: the admin has seven routes (`(admin)/admin/index.tsx`,
`comerciales.tsx`, `comerciales/[id].tsx`, `proveedores.tsx`, `productos.tsx`,
`promociones.tsx`, `usuarios.tsx`), but the admin hub links only two sections
(`admin/index.tsx:11-24`); `productos`, `promociones` and `usuarios` exist and
are unreachable from the UI. If the admin mode's tabs are its sections, that is
five or six items in a 64 px bar inside a 430 px-wide column
(`_layout.tsx`, `nav-inferior.tsx:110-111`); if the tabs stay today's filtered
`PESTANAS`, the admin mode is one Admin tab plus Catálogo and nothing changes.
The proposal does not say which.

Fix: a table `mode × tab × route × cap × min count`, an overflow rule ("Más"
sheet) above four tabs, an explicit decision on the admin hub (keep as a page
or delete it — not both), and a decision on the three orphan admin routes
(link them or remove them; either way the tab data must not silently ignore
them).

### F9 — Major — the stated problem ("drawer repeats fuel/category chips") is not true in the code

Evidence: `navegacion_brief.md:126-129` claims the drawer repeats fuel/category
filters "that also exist as chips in the screen". The only chips in the catalog
are **provider** chips (`selector-proveedor.tsx:78-117`), and the drawer does
not list providers (`nav-lateral.tsx:104-207`). The catalog screen's only other
filter is the search field (`catalogo-screen.tsx:134-137`); there are no fuel
or category chips. The real parallel menus are: header + drawer + bottom bar on
the catalog (`catalogo-screen.tsx:121,236-248`), the drawer's account footer,
and the duplicated preview bar in the admin fiche.

Fix: correct the problem list before it drives acceptance, otherwise someone
deletes the drawer's fuel filters (the only way to filter by fuel) to fix a
duplication that does not exist. Then define the drawer's responsibility as
"catalog filters only, no account section" and delete the preview bar
(`[id].tsx:264-305`).

### F10 — Major — bottom-bar spacing is per-screen guesswork and already broken; a shell must own it

Evidence: `catalogo-screen.tsx:196` hardcodes `paddingBottom: 88`;
`[id].tsx:176` hardcodes 96; `/solicitud` and `/pedidos` pass `pb-24`
(`solicitud.tsx:121`, `pedidos/index.tsx:101`); `/cartera` uses `ScreenScroll`
with no extra padding (`cartera/index.tsx:142`), and `ScreenScroll` reserves
only `32 + insets.bottom` (`screen.tsx:53`) — 32 px less than the 64 px fixed
bar plus insets (`nav-inferior.tsx:110-111`). The last client card in the
cartera list is therefore under the tab bar today, and any change of tab
height or mode breaks the four magic numbers.

Fix: the shell owns the content viewport: one container that subtracts header
height, tab-bar height and insets, and the screens stop passing bottom
padding. Add a visual check on the shortest screen (cartera list on a small
phone) to the acceptance criteria.

### F11 — Major — two stacked headers wherever `ScreenHeader` already exists

Evidence: every non-catalog screen puts the title and the back arrow inside the
scrollable body (`cartera/[id].tsx:111-119` puts the client name and email
there; `admin/index.tsx:32`; `solicitud.tsx:122`), and `Screen` applies
`paddingTop: insets.top` itself (`screen.tsx:27`). With a persistent shell
header, those screens get a header, then another header, then an extra safe-area
strip — on a 430 px-wide layout with the keyboard open, that is a real content
loss, and the back affordance becomes ambiguous (which of the two arrows?).

Fix: choose and document one pattern: shell header carries back + title, and
`ScreenHeader` becomes a body section title (no back arrow, no insets), or the
shell header is brand/account only and titles stay in the body with no back
arrow there. Update `Screen`/`ScreenScroll` in the same change so no double
top inset remains.

### F12 — Major — accessibility and touch behaviour are unspecified, and the current bar is the pattern that would be copied

Evidence: `NavInferior`'s tabs are bare `Pressable`s with no
`accessibilityRole`, no `accessibilityLabel`, no `accessibilityState.selected`
(`nav-inferior.tsx:116-137`); labels are 11 px. The duplicated preview bar goes
further and ships a **disabled dead tab** ("Solicitud", `[id].tsx:271-304`,
`disabled` + `opacity-40` with no explanation). Tab sets changing per mode
make an already unstable landmark worse for screen-reader users unless the
roles and the active state are correct. The drawer is a `Modal` with no focus
trap on web (`nav-lateral.tsx:71-79`).

Fix: one tab primitive used everywhere: `accessibilityRole="tab"` (or button +
label), `accessibilityState={{selected}}`, labels, ≥44 px targets, visible
focus ring on web, and no disabled tabs (hide what has no destination). The
acting-as banner gets a live region. Add this to the design's acceptance
criteria, not to a later polish task.

### F13 — Major — the design freezes decisions the source brief left open, with no record

Evidence: `navegacion_brief.md:3` says "pending user answers; do not launch
Goldfish review"; lines 204–218 list five open questions (tabs in admin at all,
where logout/user info lives, drawer global or catalog-only, back from
`/cartera/[id]` opened from a comercial preview, whether the preview's Catálogo
tab stays). The proposal answers Q1, Q2, Q3 and Q5 by assertion and leaves Q4
(the one the state machine needs) undefined, but the answers are not written
anywhere. A future reader sees two documents that disagree and no decision
trail.

Fix: either write the proposal down (a short resolved-decisions section in
`navegacion_brief.md` or a new design doc), or keep the review reject. At
minimum, record the answers to Q1–Q5 with the date and who decided, and delete
the "do not launch review" gate once it applies no more.

### F14 — Minor — English strings in a Spanish UI, and a fourth piece of vocabulary

Evidence: the proposal says "mode / Viewing as / Exit"; the product is es-ES
(AGENTS.md §2) and the code uses "Para cliente", "Mi cuenta", "Cerrar sesión",
"Solicitud" (`encabezado.tsx:85`, `nav-lateral.tsx:230-234`,
`nav-inferior.tsx:39-70`). The code currently mixes "Solicitud" (tab) with
"solicitud"/"pedido" in copy (`solicitud.tsx:123`, `cartera/[id].tsx:129`).

Fix: fix the copy now, in the design: "Viendo como `<nombre>`" + "Salir" (or
"Volver a administración"), and one glossary: rol, capacidad, sección, modo.
A design that reaches the implementer in English produces English identifiers
and Spanish labels that drift.

### F15 — Minor — sign-out flow is unspecified and currently silent

Evidence: `cerrarSesionLocal` swallows the error and keeps the menu open
(`nav-lateral.tsx:58-69`); on success nothing tells the user anything, and the
guarded screen they are on redirects via `guard-ruta.tsx:45` (or stays, if it
is public). Under the shell, logout must also clear the acting-as state and
decide the fate of the cart draft (`contexto.tsx:63,215` is keyed by
`clienteObjetivoId`/uid).

Fix: specify: confirmation or not, in-flight state, error message on failure,
destination (`INICIO_POR_ROL[rol]` or `/`), what happens to the draft, and that
mode/impersonation state is reset.

### F16 — Nit — the nav can lie today, and the data-driven version can repeat it

Evidence: `activa` is a hand-passed literal in four screens
(`catalogo-screen.tsx:248`, `solicitud.tsx:270`, `pedidos/index.tsx:321`,
`cartera/index.tsx:185`), and in the preview bar the Catálogo tab can never be
active (`[id].tsx:271-272`: `esActiva = id === seccion`, `seccion` is only
`cartera | pedidos`). A registry-driven tab set that keeps `activa` manual will
reproduce exactly this.

Fix: derive the active tab from the pathname, keep the registry as the single
source for route + caps, and add a small table test per role so registry, tab
visibility and group guards cannot drift apart.

## Open risks

- **Premature freeze.** The brief says no review until the user answers
  (lines 3, 223); this review is the first artifact that treats the proposal as
  decided. If the user's answers to Q1–Q5 differ, most of F1–F8 reopen.
- **Scope.** A shell change touches every route file (18 screens across 6
  group layouts), the four call sites of `NavInferior`,
  `Screen`/`ScreenScroll`, and the guards. No
  migration order or rollback is proposed; a half-migrated app (some screens
  with the shell, some without) will look worse than today.
- **Impersonation safety.** A Helpdesk banner is a UI-level signal only;
  nothing in the proposal states that writes performed "as comercial" are
  attributed correctly (`creado_por`) or that the mode is read-only. The
  backend remains the authority, but the UX has to make the identity
  unmistakable, and no design decision on that exists yet.
- **No usability evidence.** No user test, no analytics on tab usage, no
  measure for "menus stop disappearing". Acceptance criteria are all
  structural ("single shell"), none observable from a user's point of view.
- **Provider color contrast.** The provider tint is used as `--primary`
  (`catalogo-screen.tsx:115-118`); a shell header with a neutral tint next to a
  provider-tinted body risks two competing accents. Nothing says which one
  wins visually, and `textoSobreProveedor` presumably handles contrast inside
  the catalog only.
- **Desktop helpdesk.** Web renders the app as a centered 430 px column
  (`_layout.tsx`). A persistent header plus tabs plus banners in that column is
  tight; the design does not mention a desktop variant, and admin on a desktop
  is the Helpdesk scenario.
- **Drawer semantics.** Removing the account footer from the drawer while
  keeping the drawer catalog-only is proposed implicitly; if the shell header's
  account menu is broken on any screen, the admin has no fallback (today the
  drawer is one).
- **Test story.** No navigation test exists to lock the mode table; without
  one, the guards, the tab registry and the back rule will drift apart on the
  next role/capability change.
