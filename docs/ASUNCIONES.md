# Supuestos y decisiones del MVP

Regla del PRD (§11): no inventar reglas de negocio pendientes; cada supuesto se
documenta aquí. Los puntos "pendiente" del PRD que se resuelven para el MVP
están marcados con su número.

## Decisiones de stack

1. **Expo (nativo + web) con Expo Router** — un solo código para móvil, tableta y
   escritorio (PRD §5/§10.5 "web adaptable"). La alternativa Next.js fue
   descartada por el objetivo móvil principal y por evitar dos codebases.
2. **Supabase como backend (REST/PostgREST)** — Auth (GoTrue) + Postgres + RLS.
   La identidad vive en `auth.users`; `usuarios` es el perfil de negocio
   (creado por trigger `trg_handle_new_user`).
3. **Estilo shadcn/ui** mediante componentes propios en `src/components/ui`
   (patrón react-native-reusables + NativeWind), escala de grises zinc y un
   único acento ámbar `hsl(24.6 95% 53.1%)`.
4. **Hooks para todo acceso al backend** y **constantes en un único archivo**
   (`src/constants/index.ts`) — requisito explícito del proyecto.

## Reglas de negocio resueltas provisionalmente (PRD §14)

- **Nº 1 — Promociones de tienda vs. descuentos individuales:** no se acumulan.
  El específico cliente/producto sustituye al general del cliente; después se
  compara con la mejor promoción de tienda vigente y gana el porcentaje MAYOR.
  (Coherente con la nota 4 del esquema v0.5.)
- **Nº 2 — Descuentos adicionales del comercial:** solo mientras el pedido está
  `solicitado` (regla provisional del PRD §6.5). Se registran con origen
  `ajuste_comercial` y quedan auditados (fila anterior completa en `auditoria`).
- **Nº 3 — Límites de descuento del comercial:** sin límite en el MVP; el
  comercial solo actúa sobre clientes asignados (validado en BD). Decisión
  pendiente del negocio.
- **Nº 4/5/6 — Fiscalidad:** IVA 0% en las líneas (los importes se guardan como
  instantánea con estructura fiscal completa para rellenarlos cuando se decida).
  Los precios de catálogo son SIN IVA y **no se muestran impuestos en las
  fichas** (PRD §7). La facturación legal queda fuera del MVP.
- **Nº 7 — Editar/cancelar tras confirmación:** el cliente solo edita/cancela
  solicitudes `solicitado`. El comercial o admin pueden cancelar `confirmado`.
- **Nº 8 — Varias cuentas por cliente:** una cuenta por cliente (el esquema no
  lo impide: `usuarios.id_comercial` apunta a la entidad cliente si hace falta).

## Supuestos técnicos y funcionales

- **Publicado = `productos.activo = TRUE`.** El PRD menciona un "estado de
  publicación"; el esquema v0.5 no tiene columna propia, así que `activo` es el
  estado publicado y los recursos/relaciones cuelgan de él en RLS.
- **Precio vigente = periodo abierto de `producto_precios`** (`fecha_inicio <=
  fn_hoy() < fecha_fin`). Un producto sin precio vigente no aparece en el
  catálogo ni puede pedirse. Los precios tienen granularidad diaria: un cambio
  de precio el mismo día actualiza la fila del día.
- **Redondeo por línea a 2 decimales** (`round`), pendiente de la política
  fiscal definitiva (PRD §7).
- **Moneda única EUR** (CHECK en el esquema).
- **Idioma inicial español** (`es-ES`).
- **El comercial navega el catálogo a precio base** salvo que esté creando un
  pedido para un cliente asignado, en cuyo caso la app solicita el catálogo con
  `p_cliente` y el RPC valida la asignación.
- **Editar un pedido `solicitado` recalcula precios/descuentos vigentes** en el
  momento de guardar (es una re-emisión de la solicitud, con auditoría de las
  líneas anteriores). La congelación se produce al crear/confirmar, no al editar.
- **Imágenes de desarrollo** servidas vía picsum en el seed; en producción se
  usará Supabase Storage (`recursos.url`).
- **Roles** en `usuarios.rol` (cliente/comercial/admin), fijados en el alta
  (GoTrue `user_metadata`) y modificables solo por admin.
- **RLS es la frontera de autorización** (PRD §10.3): las escrituras comerciales
  solo existen vía RPC `security definer` con validación interna; el cliente
  nunca inserta/actualiza pedidos directamente.
- **Cartera:** el comercial ve/actúa sobre clientes con `id_comercial = auth.uid()`.
- **Creación de productos completa** (recursos, características) queda fuera del
  alcance inicial; el admin gestiona publicación, precios, promociones,
  usuarios y descuentos. La creación/edición completa es fase siguiente.

## Divergencias con docs/schema05.sql

- `usuarios.id` referencia `auth.users(id)`; se elimina `password_hash`
  (GoTrue gestiona credenciales).
- `fn_app_user_id()` = `auth.uid()`; el GUC `app.user_id` desaparece (el GUC
  `app.nota_estado` se mantiene para las notas del historial).
- Se añade RLS a todas las tablas y políticas por rol (el original delegaba la
  autorización en una capa de servicio).
- Se elimina el bloque opcional `app_api` (Supabase usa roles anon/authenticated/
  service_role).
- El `BEGIN/COMMIT` se reparte en migraciones versionadas.
