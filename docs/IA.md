# Conexión de herramientas IA (Stitch / AI Studio / Firebase Studio vía MCP) con este repositorio

> Documento operativo para el agente de IA que se conecte a este repo por MCP.
> **El agente DEBE leer este documento y `docs/PRD.md` antes de modificar
> cualquier archivo** (regla del propio PRD, sección 11).

## 1. Qué es este proyecto

Catálogo de productos y gestión comercial ("Estufas") — MVP funcional.
Detalles en [`README.md`](README.md).

Stack: **Expo SDK 57** (fijado a la versión de Expo Go del Play Store — **no
actualizar el SDK sin pedirlo**), Expo Router, NativeWind + componentes
react-native-reusables (estilo shadcn), **Supabase local** (Postgres 17 +
PostgREST + Auth, vía Docker). El backend es 100% SQL (migraciones + RLS +
RPC); no hay servidor de aplicación.

## 2. Orden de lectura obligatorio

1. [`README.md`](README.md)
2. [`docs/PRD.md`](PRD.md) — especificación funcional (referencia principal)
3. [`docs/ASUNCIONES.md`](ASUNCIONES.md) — reglas resueltas y supuestos explícitos
4. [`docs/GOOGLE_STITCH.md`](GOOGLE_STITCH.md) — design brief
5. [`supabase/migrations/`](../supabase/migrations/) — esquema, RLS y funciones de negocio
6. [`src/lib/types.ts`](../src/lib/types.ts) + [`src/hooks/`](../src/hooks/) — contratos de datos

## 3. Ámbitos de escritura (dónde SÍ y dónde NO)

| Área | Archivos | Regla |
|---|---|---|
| Pantallas | `src/app/**`, `src/screens/**` | Permitido |
| Componentes UI | `src/components/ui/**` | Permitido — mantener estilo shadcn (registro de react-native-reusables, `components.json`) |
| Datos | `src/hooks/**` | **Obligatorio**: toda llamada a Supabase va en un hook; las pantallas NO llaman a supabase directamente |
| Constantes | `src/constants/index.ts` | Toda constante nueva va aquí |
| Backend | `supabase/migrations/*.sql` | Solo **archivos NUEVOS numerados** (`0005_…`). **PROHIBIDO editar** `0001`–`0004` (ya aplicados) y prohibido editar la BD desde Studio |
| Datos de prueba | `supabase/seed.sql` | Permitido |
| Tests | `supabase/tests/*.sql` (pgTAP) | Obligatorio añadir test para cada regla nueva |
| Docs | `docs/*.md`, `README.md` | Obligatorio actualizar cuando cambie una regla |

## 4. Reglas de negocio NO negociables

- **Permisos en backend**: autorización siempre en RLS/RPC, nunca confiando en la UI.
- **No inventar reglas pendientes**: las decisiones sin cerrar están en PRD §14 y en ASUNCIONES; documentar cualquier supuesto nuevo en `docs/ASUNCIONES.md`.
- Precios congelados en la línea del pedido al crearse; cambios de precio nunca alteran pedidos existentes.
- Máquina de estados: `solicitado → confirmado → en_preparacion → completado`; cancelación según rol (ver ASUNCIONES).
- Descuentos: específico cliente/producto sustituye al general; después gana el mayor contra la promo de tienda; nunca se acumulan.
- Los impuestos NO se muestran en el catálogo; precios SIN IVA; moneda EUR; textos en español (es-ES).

## 5. Sistema de diseño (contrato visual)

- Escala de grises (zinc) + **único acento ámbar** `hsl(24.6 95% 53.1%)` (#F97316).
- Tokens en [`src/global.css`](../src/global.css) — usarlos vía clases Tailwind, no colores literales.
- Componentes: los del registro oficial de react-native-reusables (si falta alguno, añadirlo desde el registro, no improvisar otro estilo).
- Iconos: `lucide-react-native`. Mobile-first, soporte web, modo oscuro.

## 6. Puertas de verificación (ejecutar tras cada cambio)

```powershell
npm run typecheck                            # TypeScript estricto — obligatorio
npx expo export --platform web               # build de producción web
npx supabase db reset                        # reconstruye la BD (migraciones + seed)
npx supabase test db                         # 24 tests pgTAP — obligatorio si toca backend
```

Notas de esta máquina:

- Docker Desktop tiene habilitado `tcp://127.0.0.1:2375`; si el CLI de Supabase
  falla con `npipe … permission denied`, usar `$env:DOCKER_HOST = "tcp://127.0.0.1:2375"`.
- Supabase local: API en `http://127.0.0.1:54321` (Swagger: `/rest/v1/`),
  Studio en `http://127.0.0.1:54323`, Postgres directo en `127.0.0.1:54322`.
- Para probar desde un móvil en la LAN existe el puente `netsh portproxy
  8450 → 127.0.0.1:54321` y `.env.local` (gitignored) apunta a él. No borrarlo.

## 7. Cómo se descubre la API (para el agente)

- Cada tabla/vista de `public` → `GET/POST/PATCH/DELETE /rest/v1/<nombre>`.
- Cada función (no trigger) de `public` → `POST /rest/v1/rpc/<nombre>`.
- Lista viva: Swagger `/rest/v1/` o Studio → API Docs.
- Regla del proyecto: consumir SIEMPRE vía hooks en `src/hooks`.

## 8. Criterios de aceptación para cualquier cambio de la IA (PRD §11)

1. `npm run typecheck` pasa.
2. Si toca datos: `supabase test db` pasa (con los tests nuevos).
3. Si cambia una regla de negocio: `docs/ASUNCIONES.md` actualizado.
4. Permisos validados en backend (RLS/RPC), no solo UI.
5. Sin cambios destructivos; históricos comerciales intactos.
6. Mensajes de commit descriptivos en el idioma del cambio.

## 9. Prompt inicial recomendado para pegar en Stitch/AI Studio

```text
Eres un desarrollador trabajando en el repositorio "estufas" (catálogo y
gestión comercial). ANTES de modificar cualquier archivo lee, en este orden:
docs/IA.md, README.md, docs/PRD.md, docs/ASUNCIONES.md. Cumple estrictamente
sus reglas: backend solo en migraciones nuevas (0005…), autorización en
RLS/RPC, llamadas a datos solo desde hooks, constantes en src/constants,
estilo shadcn gris + acento ámbar, textos en español. Tras cada cambio
ejecuta `npm run typecheck`; si tocas backend, también `npx supabase test db`.
No actualices el SDK de Expo (fijado a 57). Si una regla de negocio está
"pendiente" en el PRD, no la inventes: pregunta o documenta el supuesto.
```
