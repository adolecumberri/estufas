# Estufas — Catálogo y gestión comercial (MVP)

Aplicación de catálogo de productos y gestión comercial (PRD en [`docs/PRD.md`](docs/PRD.md)) construida con:

- **Frontend:** Expo (SDK 58) + Expo Router — nativo (iOS/Android) y web desde un único código. Estilo shadcn/ui (escala de grises + acento ámbar) con NativeWind y componentes propios en `src/components/ui`.
- **Backend:** Supabase (PostgreSQL + Auth + PostgREST). El esquema parte de `docs/schema05.sql`, adaptado a Supabase en [`supabase/migrations`](supabase/migrations).
- **Autorización:** Row Level Security + funciones RPC transaccionales (`security definer`) — los permisos se comprueban en la base de datos, nunca en el cliente.
- **Llamadas al backend:** exclusivamente mediante hooks personalizados en [`src/hooks`](src/hooks) (regla de arquitectura del proyecto). Constantes globales en [`src/constants/index.ts`](src/constants/index.ts).

## Requisitos

- Node.js ≥ 20
- Docker Desktop (para el stack local de Supabase)
- Supabase CLI (`npx supabase` lo descarga automáticamente)

## Puesta en marcha

```bash
# 1. Dependencias (el caché de npm queda dentro del repo por .npmrc)
npm install

# 2. Backend local (requiere Docker en marcha)
npx supabase start          # arranca Postgres+Auth+Studio en http://127.0.0.1:54323

# 3. Frontend
npm run web                 # navegador
npm start                   # Expo Go / emuladores

# Sin Docker: crea un proyecto en supabase.com y usa variables de entorno:
#   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
# y aplica las migraciones con `npx supabase db push` (previa `supabase login`).
```

## Usuarios de desarrollo (seed)

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@estufas.local` | `Admin123!` |
| Comercial | `comercial@estufas.local` | `Comercial123!` |
| Cliente particular | `cliente@estufas.local` | `Cliente123!` |
| Cliente empresa | `empresa@estufas.local` | `Empresa123!` |

El seed carga marcas, categorías, características, 7 productos (6 publicados + 1 borrador), precios, una promoción del 5% y descuentos de ejemplo. El cliente particular y la empresa están asignados al comercial de prueba; la empresa tiene 10% de descuento general y una excepción del 0% en el producto LP-9.

## Comandos

```bash
npm run typecheck        # TypeScript estricto
npm run export:web       # build web a dist/
npx supabase db reset    # recrea la BD local (migraciones + seed)
npx supabase test db     # tests pgTAP (supabase/tests)
```

> **Nota Windows:** `npx expo export --platform android` puede fallar en el paso de
> bytecode de Hermes (`hermesc exited with non-zero code: 6`) en algunas
> máquinas Windows. El bundle JS es correcto — usa `--no-bytecode` para
> verificar en local; los builds de producción (EAS Build, Linux/macOS) compilan
> el bytecode sin problema. Los builds de desarrollo (`expo run:android`) no
> usan bytecode y no se ven afectados.
>
> **Nota Windows (CLI de Supabase):** si `supabase start` falla con
> `permission denied while trying to connect to the docker API at npipe://...`,
> activa en Docker Desktop *Settings → General → "Expose daemon on
> tcp://localhost:2375 without TLS"* y ejecuta
> `$env:DOCKER_HOST = "tcp://127.0.0.1:2375"` antes del comando.

## Estructura

```
src/
  app/           rutas Expo Router (catálogo, acceso, registro, pedidos, cartera, admin)
  components/ui/ componentes estilo shadcn (button, card, input, badge…)
  contexts/      auth y solicitud en curso (carrito de pedido persistente)
  hooks/         TODA llamada al backend vive aquí
  constants/     constantes globales
  lib/           cliente supabase, tipos, formato, tema
supabase/
  migrations/    esquema + RLS + RPC (versionado)
  tests/         tests pgTAP de RLS, precios y permisos
  seed.sql       datos de desarrollo
docs/            PRD, supuestos y decisiones
```

## Alcance del MVP

Catálogo público (búsqueda/filtros, ficha con características), registro de clientes (particular/empresa), solicitudes de pedido con precios congelados y descuentos (específico > general > mejor promoción, sin acumular), cancelación/confirmación/avance de estados por rol, ajustes de descuento por línea con trazabilidad, cartera comercial y administración básica (publicación, precios, promociones, asignaciones). Sin stock, sin facturación legal y con IVA 0% (pendiente de decisión fiscal).

Los supuestos explícitos están en [`docs/ASUNCIONES.md`](docs/ASUNCIONES.md).
