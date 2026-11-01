# ADR 0004: Arquitectura por features (vertical slices)

- **Estado**: aceptado (2026-11-01).
- **Contexto**: los archivos estaban organizados por tipo
  (`components/`, `hooks/`, `contexts/`, `lib/`), con dependencias cruzadas
  difíciles de acotar y pantallas que duplicaban patrones.
- **Decisión**: reestructurar `src/` en **vertical slices**:
  - `src/app/` — rutas delgadas con grupos `(publico)(carrito)(cliente)
(comercial)(admin)`.
  - `src/features/` — `catalogo/`, `auth/`, `carrito/`, `pedidos/`,
    `cartera/`, `admin/` (cada uno con sus `hooks/`, `componentes/`,
    `lib/`, `screens/` o lo que necesite).
  - `src/shared/` — `ui/`, `componentes/`, `seguridad/`, `navegacion/`,
    `lib/`, `constantes/`.
  - Dependencias permitidas: `app → features → shared`; prohibido
    feature→feature y shared→features.
  - Historia conservada con `git mv` (renames en el índice).
- **Consecuencias**: cada feature es autónoma y revisable en una carpeta; las
  primitivas viven en shared y las pantallas solo componen; el alias `@/*`
  sigue apuntando a `src/*`. Ver AGENTS.md §1 y `docs/ARQUITECTURA_APP.md`.
