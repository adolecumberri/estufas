# Arquitectura de la app: sistema de diseño y organización de archivos

Documento de decisión. Responde a: (1) sistema de diseño que seguir, (2) qué
arquitectura de archivos usar, (3) ¿arquitectura por features?

Estado de partida (hoy):

```
src/
  app/          rutas de Expo Router (pantallas + layouts)
  screens/      pantallas "reales" (catalogo-screen)
  components/   ui/ (8 primitivas) + catalogo/ + cartera/ + navegacion/
  contexts/     auth, solicitud (carritos), proveedor activo
  hooks/        use-auth, use-catalogo, use-pedidos, use-comercial, use-admin...
  lib/          supabase, cache, precios, catalogo-local, format, navegacion...
  constants/    SUPABASE, ROLES, COMBUSTIBLES...
```

Es una arquitectura **por capas técnica** (components/hooks/lib), que funciona
con 5 features pero se degrada: todo lo de una feature queda repartido en 4
carpetas, y las dependencias entre features no están acotadas.

---

# 1. Sistema de diseño

## 1.1 Tokens (ya existen; hay que usarlos SIEMPRE)

Fuente: `src/global.css` (clases Tailwind) + `src/lib/theme.ts` (valores que
necesitan JS: iconos, NAV_THEME).

| Grupo | Token | Uso |
|---|---|---|
| Color base | `background`, `foreground`, `card`, `muted`, `border`, `accent`, `destructive` | superficies y texto |
| Acento | `--primary` (verde `#415D43` por defecto) | acciones primarias |
| Proveedor | `--primary` dinámico en catálogo (Eider `#E1680F`, Fansa `#6FC2B9`) | solo zona catálogo |
| Iconos | `useColoresIcono()` (`primario`, `primerPlano`, `tenue`, `destructivo`) | lucide |
| Radios | `rounded-[10px]` (cards/alertas), `rounded-md` (botones/inputs) | — |
| Espaciado | escala Tailwind (`p-4`, `gap-2/3`) — NO valores arbitrarios salvo casos justificados | — |

**Reglas duras (ir a AGENTS.md):**

1. **Ningún color literal** en pantallas (`#hex`, `hsl(...)`): solo clases/tokens.
2. **Ningún `style={{}}`** salvo: colores dinámicos de proveedor, `vars()` y
   `paddingTop: insets.top` (vía `Screen`).
3. **Nada de Card/Modal/Header a mano**: se componen de primitivas.

## 1.2 Primitivas actuales (react-native-reusables)

`ui/`: `Badge`, `Button`, `Card`, `Input`, `Label`, `Separator`, `Skeleton`,
`Text` (con `cva` para variantes/sizes).

## 1.3 Patrones que faltan (crear una vez, usar siempre)

| Primitiva | Sustituye a | Dónde |
|---|---|---|
| `Screen` | `View flex-1 bg-background` + `paddingTop: insets.top` repetido | `shared/ui/screen.tsx` |
| `ScreenHeader` | flecha atrás + título duplicados en ~10 pantallas | `shared/componentes/screen-header.tsx` |
| `ScreenScroll` | `ScrollView` con paddings repetidos | `shared/ui/screen-scroll.tsx` |
| `SectionTitle` | `<Text className="text-sm font-semibold">` repetido | `shared/ui/section-title.tsx` |
| `ListCard` / `Row` | cards de filas + chevron hechos a mano | `shared/componentes/list-card.tsx` |
| `EmptyState` | "No hay pedidos/clientes/productos..." repetido | `shared/componentes/empty-state.tsx` |
| `LoadingState` / `ErrorState` | spinners y errores repetidos | `shared/componentes/estados.tsx` |
| `ConfirmDialog` | `Modal` + overlay + botones a mano | `shared/componentes/confirm-dialog.tsx` |
| `FormField` | `Label` + `Input` + error repetido | `shared/ui/form-field.tsx` |
| `Chip` / `ChipGroup` | filtros/badges hechos a mano | `shared/ui/chip.tsx` |
| `StepperCantidad` | −/+ cantidad en ficha y carrito | `shared/ui/stepper.tsx` |
| `StatCard` | tarjetas de métricas de cartera/pedidos | `shared/componentes/stat-card.tsx` |
| `Modal` (contenedor) | modales del admin a mano | `shared/ui/modal.tsx` |

## 1.4 Estados de pantalla (contrato)

Toda pantalla debe cubrir: **cargando → error (con reintento) → vacío → datos**.
Se implementa con `LoadingState` / `ErrorState` / `EmptyState`, no ad-hoc.

## 1.5 Gobernanza

- Las primitivas se copian del registro **react-native-reusables**; no se
  improvisan variantes fuera de `cva`.
- Un componente nuevo que se use en 2+ sitios → sube a `shared/`.
- Revisión: si una pantalla repite más de 6 líneas de layout, se extrae.

---

# 2. Arquitectura de archivos: **por features (vertical slices)**

Sí: con la Fase de permisos empezamos a tener lógica transversal + features con
reglas propias (catálogo, carrito, pedidos, cartera, admin). La capa técnica no
escala: un cambio en "cartera" ya toca `app/`, `components/cartera`, `hooks`,
`lib` y `contexts`.

## 2.1 Estructura objetivo

```
src/
  app/                        # SOLO rutas: layouts + re-export de screens
    (publico)/_layout.tsx     #   guard: nadie
    (publico)/index.tsx       #   → features/catalogo/screens/catalogo
    (publico)/acceso.tsx
    (publico)/registro.tsx
    (cliente)/_layout.tsx     #   guard: cliente+
    (cliente)/pedidos/...
    (comercial)/_layout.tsx   #   guard: comercial+
    (comercial)/cartera/...
    (admin)/_layout.tsx       #   guard: admin
    (admin)/comerciales/...

  features/
    catalogo/
      api/                    # llamadas a Supabase/RPC y SQLite de catálogo
      componentes/            # TarjetaProducto, SelectorProveedor, Buscador...
      hooks/                  # useCatalogo, useProducto
      lib/                    # catalogo-local.ts, imagenes.ts
      screens/                # catalogo-screen, producto-screen
      modelos.ts              # tipos de la feature
      index.ts                # API pública de la feature (lo único importable)
    carrito/
      modelo/                 # carrito, borradores por cliente, reglas de fusión
      contexto.tsx            # SolicitudProvider
      componentes/            # carrito UI, popup cambio proveedor
      hooks/
    pedidos/
    cartera/
    admin/
    auth/

  shared/                     # kernel transversal (SIN dependencias de features)
    ui/                       # primitivas de diseño (registro)
    componentes/              # patrones: Screen, ScreenHeader, EmptyState...
    seguridad/                # capacidades + usePermisos (cross-cutting)
    lib/                      # supabase, cache, format, navegacion, theme
    hooks/                    # useAuth (o en features/auth)
    tipos/                    # tipos de BD compartidos

  constants/  assets/  global.css
```

## 2.2 Reglas de dependencia (importantes)

```
app ──► features ──► shared
         │  ▲
         └──┘  (una feature NO importa otra feature; si hace falta, se comparte
                el contrato en shared o se compone en la capa de screen)
```

- `shared` **no** importa nunca de `features`.
- Cada feature expone `index.ts`; fuera de ella solo se importa desde ahí
  (evita acoplarse a rutas internas).
- `shared/seguridad` (capacidades/permisos) es el único módulo que todas las
  features pueden importar directamente: es el kernel.
- Nombres: componentes `PascalCase.tsx`, hooks `use-x.ts`, lógica pura `x.ts`,
  tipos `modelos.ts` por feature.

## 2.3 Migración incremental (strangler), sin big-bang

1. **Ahora**: crear `shared/` moviendo `components/ui` → `shared/ui` y
   `lib/{supabase,cache,format,navegacion,theme,utils}` → `shared/lib`
   (imports con alias `@/` resueltos de una vez; typecheck de red).
2. Crear `shared/seguridad` con `capacidades.ts` + `use-permisos` (Fase 1,
   ya en marcha).
3. Migrar **catálogo** primero (es la feature más grande y la que más toca):
   `components/catalogo` + `hooks/use-catalogo` + `hooks/use-producto` +
   `lib/{catalogo-local,imagenes}` + `screens/catalogo-screen` →
   `features/catalogo/`.
4. Luego `carrito` (contexto + reglas), `pedidos`, `cartera`, `admin`, `auth`.
5. Rutas: al final, reestructurar `app/` en grupos con guards y dejar cada
   ruta como re-export de 1 línea.
6. Borrar las carpetas viejas (`screens/`, `components/{catalogo,cartera}`,
   `hooks/`, `lib/`) cuando estén vacías.

Cada paso: `npm run typecheck` + prueba en móvil, commits pequeños.

## 2.4 Qué NO hacer

- No crear un `features/` vacío con 6 carpetas a la vez (big-bang): migrar
  feature a feature.
- No duplicar lógica en `app/`: la ruta no tiene lógica, solo composición.
- No meter utilidades genéricas dentro de una feature (van a `shared/lib`).

---

# 3. Estado de ejecución

- **Fase 1 (roles)**: en marcha — `shared/seguridad/capacidades.ts` +
  `use-permisos` + nav por capacidad (se hace en `src/lib/permisos.ts` +
  `src/hooks/use-permisos.ts` para no romper imports; se moverá a
  `shared/seguridad` en el paso 2 de migración).
- **Auditoría UI**: en curso → `docs/AUDITORIA_UI.md` (inventario y plan de
  primitivas).
- **Siguiente decisión**: aprobar esta estructura y empezar por el paso 1
  (`shared/`) o por el paso 2 (seguridad) según prioridad.
