# Project description for Google Stitch

> Pegar este documento como prompt de diseño en Google Stitch.
> La interfaz de la app está en ESPAÑOL; la descripción va en inglés para
> mejor interpretación del modelo.

## One-paragraph elevator pitch

"Brasa y Verde" is a product catalog and sales-management app for a stove/heater
business. It lets end customers (individuals and companies) browse a public
catalog, request quotes for products, and track their orders, while the
company's sales reps ("comerciales") manage their assigned customers, apply
discounts, confirm orders, and move them through fulfillment states. Admins
manage the catalog, prices, store promotions, and user assignments. It is a
mobile-first app (also usable on desktop web) with a clean, professional
catalog look.

## Visual design system

- **Style:** shadcn/ui aesthetic — minimal, rounded corners (radius 10px),
  subtle borders, generous whitespace, flat cards with soft shadows on web.
- **Palette:** greyscale only (zinc scale) + **one accent color: amber/orange**
  (`#F97316`, HSL 24.6 95% 53%). Buttons and highlights use amber; everything
  else is greys (white background, zinc-950 text, zinc-200 borders, zinc-100
  muted surfaces). Destructive actions in muted red.
- **Dark mode:** supported (zinc-950 background, same amber accent).
- **Typography:** system font, clear hierarchy: 24px bold screen titles,
  16px body, 14px secondary text, 12px captions.
- **Components:** buttons (primary amber, secondary grey, outline, ghost),
  cards, chips/filter pills, badges (status, discount %, energy label),
  inputs with labels, quantity steppers, list rows with chevron, empty states
  with a friendly message and a CTA, skeletons while loading.
- **Icons:** thin line icons (lucide style), 20px.

## Users and roles

1. **Visitor (anonymous):** browses published products only, sees public
   prices without any discount, can search and filter. No orders visible.
2. **Cliente (customer):** signs up as "Particular" (individual) or "Empresa"
   (company, requires legal name + NIF/CIF). Sees catalog with their own
   prices/discounts, builds quote requests, edits/cancels pending requests,
   sees their order history and status timeline.
3. **Comercial (sales rep):** sees ONLY their assigned customers ("cartera"),
   their conditions and orders; creates orders on behalf of a client; can
   confirm orders, advance states, cancel, and adjust per-line discounts with
   an audit note.
4. **Admin:** manages products (publish/unpublish, set price), store-wide
   promotions, users, rep assignments and client discounts. Sees everything.

## Screens (mobile-first)

### 1. Catalog home (`/`)
- Top bar: app name "Brasa y Verde", cart icon with item-count badge, account icon
  (or login icon when anonymous).
- Search input (placeholder "Buscar por nombre o referencia").
- Horizontal row of category filter chips (Pellet, Leña, Aire, Insertable,
  Canalizada, Ventilada, Fundición, Hogares) — active chip filled amber.
- 2-column product grid; each card: square product photo, name (2 lines),
  brand · reference, final price in bold, original price strikethrough when
  discounted, discount badge, optional energy-label badge (A++ … G).
- "Cargar más" button for pagination.

### 2. Product detail (`/catalogo/[id]`)
- Back arrow + product reference in header.
- Full-width image carousel (main + gallery).
- Title, brand, category chips, energy badge.
- Price card: final price large, base price strikethrough, discount badge
  with its origin ("Descuento de cliente", "Descuento específico",
  "Promoción de tienda"), note "precios sin impuestos".
- Specs grouped in cards ("Datos técnicos", "Prestaciones"): rows
  name — value + unit (e.g. "Potencia nominal — 9 kW", "Programable — Sí").
- Quantity stepper (- / n / +) next to an amber "Añadir a la solicitud" button.

### 3. Login (`/acceso`)
- Centered card: email + password, error message in red, primary "Entrar",
  link "¿No tienes cuenta? Regístrate", ghost "Volver al catálogo".

### 4. Registration (`/registro`)
- Segmented control "Particular | Empresa"; when Empresa, extra fields
  "Razón social" and "NIF/CIF". Fields: name, surnames, email, phone,
  password. Primary "Crear cuenta".

### 5. Quote request cart (`/solicitud`)
- Title "Tu solicitud".
- For reps: banner "Pedido para un cliente asignado" with "Cambiar" button.
- Line items: thumbnail, name, reference, unit price (with discount note),
  quantity stepper, line total, delete icon.
- Total row "Total (sin impuestos)" in bold.
- Optional notes textarea; primary "Enviar solicitud"; helper text about
  commercial confirmation.

### 6. Orders list (`/pedidos`)
- Header "Pedidos" + user email + logout icon.
- Cards: "Pedido nº N", status badge, date, line count, total.
- Status badge colors: Solicitado (grey), Confirmado (amber), En preparación
  (outline), Completado (grey), Cancelado (red).
- Empty state with "Ver catálogo" button.

### 7. Order detail (`/pedidos/[id]`)
- Header with number + status badge.
- Info card (date, notes), lines card (name, ref, unit price, discount origin,
  total), total row.
- History card: timeline "solicitado → confirmado → …" with date, actor note.
- Role-based actions: client → "Editar solicitud" / "Cancelar solicitud";
  rep/admin on "Solicitado" → "Confirmar pedido" / "Cancelar"; on
  "Confirmado" → "Marcar en preparación"; on "En preparación" → "Marcar
  completado"; rep can tap "Ajustar descuento" per line (inline % input).

### 8. Rep portfolio (`/cartera`) and client detail (`/cartera/[id]`)
- List of assigned clients: name/company, type badge (Particular/Empresa),
  email, current general discount.
- Client detail: contact card, "Crear pedido para este cliente" CTA, general
  discount editor (% input + save), per-product discount list (add via product
  chips, 0% = exclusion, remove), client's orders.

### 9. Admin (`/admin`)
- Menu cards: Productos, Promociones, Usuarios (+ logout).
- **Productos:** list with "Publicado/Borrador" badge, current price, toggle
  publish, inline new-price input + save.
- **Promociones:** create form (name, %), list with activate/deactivate.
- **Usuarios:** list with role badges; for clients: assign rep (rep chips),
  reset discount.

## Core flows (happy path)

1. Visitor browses catalog → product detail → "Añadir" → prompted to log in.
2. Client signs up, adds products with quantities, sends request (estado
   "Solicitado", prices/discounts frozen server-side).
3. Assigned rep opens cartera → order → confirms it (only rep/admin can).
4. Rep advances Confirmado → En preparación → Completado; can cancel at
   early states; can adjust line discounts while Solicitado (audited).
5. Admin keeps catalog/prices/promotions up to date; price changes never
   alter existing orders.

## Business rules to reflect in UI copy/behavior

- Prices shown without taxes; catalog prices are net.
- Discount logic: specific client+product discount replaces the client's
  general discount; then the best active store promotion wins if higher;
  discounts never stack.
- Orders start as "Solicitado"; only the responsible rep or an admin can
  confirm; a client can edit/cancel only while "Solicitado".
- Quote lines keep a snapshot of name, price and discount at creation time.

## Data model (context only, for coherent screens)

Entities: usuarios (roles cliente/comercial/admin), marcas, tipos_producto,
categorias (grouped by Combustible/Instalación/Estilo), productos (reference,
name, description, energy label, published flag), recursos (images), 
caracteristicas (typed spec dictionary) + producto_caracteristica,
producto_precios (dated periods), descuentos_cliente_producto,
promociones_tienda, pedidos (number, state, client, creator, rep),
pedido_lineas (frozen amounts, IVA 0% for MVP), pedido_historial_estados,
auditoria.

## Output notes

- Mobile-first; desktop web should reuse the same layout (max-width container
  centered) rather than a different design.
- Generate screens for BOTH light and dark mode if supported.
- Keep the visual language strictly greyscale + amber; no other accent colors.
