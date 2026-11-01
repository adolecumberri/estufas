# Bitácora del proyecto

Registro cronológico de decisiones y cambios relevantes.

## 2026-11-01 — Calidad y consolidación

- **Roles en cascada (app)**: implementadas las 4 fases de ARQUITECTURA_ROLES
  (capacidades/use-permisos, grupos de rutas `(publico)(carrito)(cliente)
  (comercial)(admin)` con GuardRuta, alcance + supabase-seguro en hooks,
  selector por proveedor y "Creado por" en pedidos). Ver `docs/FEATURES.md`.
- **Backend 0020-0023**: catálogo general (comercial por defecto +
  `es_catalogo_general`), asignación automática del comercial por defecto,
  `fn_proveedores_visibles()` anónimo = proveedores del defecto, y
  `crear_pedido` con `creado_por` = actor real + `comercial_id` con fallback
  al defecto; nuevo RPC `fn_pedido_detalle` (creado_por_nombre/rol).
  Migraciones aplicadas en local; pgTAP 10_roles_cascada (11 asserts) creado.
- **Sistema de diseño 3/3**: auditoría (`docs/AUDITORIA_UI.md`), primitivas
  nuevas (`shared/componentes`, `shared/ui` ampliado) y regla de composición
  en AGENTS.md.
- **Reestructura por features**: `src/shared/**` y `src/features/**`
  (historia conservada vía renames en el índice git). Regla de dependencias
  `app → features → shared` en AGENTS.md.
- **Calidad**: ESLint (config flat Expo SDK 57; reglas ruidosas
  `react-hooks/set-state-in-effect` y `react-hooks/refs` silenciadas con
  justificación en `eslint.config.js`), Prettier (printWidth 100, singleQuote,
  trailingComma es5), `.gitattributes` LF, `npm run verify` (typecheck + lint +
  export android), hook pre-commit sin dependencias (`.githooks/pre-commit`),
  tipos generados de Supabase (`src/shared/lib/database.types.ts`), ADRs
  0001-0004 y `docs/FEATURES.md`.

## Historia previa (resumen)

- **2026-10-20/31**: modelo multi-empresa (proveedores, visibilidad por
  comercial, pedidos sin mezcla de proveedores), descuentos por combustible,
  datos técnicos JSONB + precios de transporte, catálogo local (snapshot +
  versión), endurecimiento de seguridad (registro siempre cliente, RLS de
  proveedores, bloqueos FOR SHARE), icono/color por proveedor y migraciones
  0001-0019. Detalle en los commits y en `docs/ARQUITECTURA_ROLES.md`.
