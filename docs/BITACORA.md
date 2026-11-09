# Bitácora del proyecto

Registro cronológico de decisiones y cambios relevantes.

## 2026-11-09 — Supabase Cloud + desloppify

- **Migración local → cloud**: migraciones 0001-0026 aplicadas al proyecto
  cloud `estufas` (bvulkrggcicftjalfctz) vía Management API y datos del stack
  local copiados con `pg_dump --column-inserts` (27 tablas + auth.users/
  identities). Verificado: counts idénticos (productos 1466, usuarios 7),
  login admin OK, `fn_proveedores_visibles` = Eider+Fansa y precios idénticos
  al local. Ajustes documentados en `docs/MIGRACION_CLOUD.md` (search_path en
  11 funciones de trigger, triggers de negocio off durante la carga, FK
  circular, seed de 0005/0020 truncado). ⚠️ Revocar el access token de la
  Management API.
- **Desloppify (rama desloppify/code-health)**: escaneo inicial strict 19.5
  → **77.7** tras revisión subjetiva de 20 dimensiones y arreglos: orígenes
  de descuento 0025 añadidos a `ORIGENES_DESCUENTO` (fuera el cast de
  precios.ts), `APP.slug` alineado, `nav-lateral` movido a
  `features/catalogo/componentes`, `parseJson` ahora advierte JSON corrupto,
  3 imports/vars muertas eliminadas, comentarios duplicados de precedencia
  podados, `scorecard.png` en `.gitignore`. Pendientes para otra pasada:
  tests del frontend, extracción de hooks en pantallas grandes
  (pedidos/cartera [id]), desduplicar librerías de iconos y retirada del
  legado combustible.

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
- **Descuentos por proveedor** (ADR 0005): backend 0024-0026 (tablas
  `descuentos_cliente_proveedor`/`descuentos_cliente_categoria` +
  `descuentos_historial` con actor real y rol, precedencia producto >
  categoría acotada al proveedor > proveedor > general, combustible retirado a
  legacy, RPCs de upsert/anular con alcance admin/comercial); tests pgTAP 11
  (precedencia + auditoría) y 06 reescrito al estado legacy; UI en la ficha de
  cliente (admin con capacidad); `precios.ts` + `catalogo-local.ts` replican la
  cadena en el cálculo offline (fleco: proveedor_id y categorías del producto
  se pasan a `ProductoParaPrecio`).

## Historia previa (resumen)

- **2026-10-20/31**: modelo multi-empresa (proveedores, visibilidad por
  comercial, pedidos sin mezcla de proveedores), descuentos por combustible,
  datos técnicos JSONB + precios de transporte, catálogo local (snapshot +
  versión), endurecimiento de seguridad (registro siempre cliente, RLS de
  proveedores, bloqueos FOR SHARE), icono/color por proveedor y migraciones
  0001-0019. Detalle en los commits y en `docs/ARQUITECTURA_ROLES.md`.
