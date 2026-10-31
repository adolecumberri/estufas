# Auditoría de UI — estado actual y propuesta de sistema de diseño

> Fecha: 2026-10-31. Conteos por regex sobre el árbol `src/` (aprox., verificables).
> Objetivo: inventario honesto de la UI para unificar componentes y preparar una
> arquitectura por features.

## 1. Inventario de primitivas (`src/components/ui`)

| Primitiva | Qué exporta realmente | Variantes / tamaños | Archivos que la importan |
|---|---|---|---|
| `badge.tsx` | `Badge`, `badgeVariants`, `badgeTextVariants`, `BadgeProps` | variant: `default` \| `secondary` \| `destructive` \| `outline`. Sin tamaño. | 11 |
| `button.tsx` | `Button`, `buttonVariants`, `buttonTextVariants`, `ButtonProps` | variant: `default` \| `destructive` \| `outline` \| `secondary` \| `ghost` \| `link`; size: `default` \| `sm` \| `lg` \| `icon` | 15 |
| `card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Sin variantes; radio fijo `rounded-xl`, `gap-6`, `py-6`, `px-6` | 16 |
| `input.tsx` | `Input` | Sin variantes; solo estado disabled | 9 |
| `label.tsx` | `Label` | Sin variantes | 3 |
| `separator.tsx` | `Separator` | `orientation`: horizontal \| vertical; `decorative` | 8 |
| `skeleton.tsx` | `Skeleton` | Sin variantes (solo `animate-pulse`) | **1** (infrautilizado) |
| `text.tsx` | `Text`, `TextClassContext` | variant: `default` \| `h1` \| `h2` \| `h3` \| `h4` \| `p` \| `blockquote` \| `code` \| `lead` \| `large` \| `small` \| `muted` | 24 |

**Conclusión parcial**: las primitivas shadcn existen y son completas, pero
faltan las *compuestas de pantalla* (cabecera, estado vacío, modal de
confirmación, chip presionable) y `Skeleton`/`Label` apenas se usan.

## 2. Patrones repetidos a mano

| Patrón | Archivos (nº aprox. de apariciones) | Primitiva que falta |
|---|---|---|
| Cabecera de pantalla con flecha atrás (`Pressable` + `ChevronLeft` + título) | `src/app/admin/index.tsx` (2), `admin/productos.tsx` (2), `admin/promociones.tsx` (2), `admin/proveedores.tsx` (2), `admin/usuarios.tsx` (2), `admin/comerciales.tsx` (2), `admin/comerciales/[id].tsx` (2), `dev/acceso.tsx` (2) — 8-9 archivos con el mismo bloque | `ScreenHeader` / `Screen` |
| Contenedores con `rounded-[10px]` (card ad-hoc, distinto del `rounded-xl` de `Card`) | `registro.tsx` (8), `solicitud.tsx` (5), `catalogo-screen.tsx` (3), `tarjeta-producto.tsx` (3), `pedidos/index.tsx` (2), `pedidos/[id].tsx` (2), `comerciales.tsx` (2), `proveedores.tsx` (2), `nav-lateral.tsx` (2), `buscador.tsx` (1), `chips-categorias.tsx` (1), `selector-proveedor.tsx` (1), `tarjeta-cliente.tsx` (1), `dev/acceso.tsx` (1) — ~15 archivos, ~36 usos | Token de radio unificado + `Card compacto` |
| Modales "a mano" (`Modal` + overlay + estado propio abierto/guardando/mensaje) | `admin/comerciales.tsx` (3), `admin/proveedores.tsx` (4), `nav-lateral.tsx` (3) — 3 archivos, ~10 usos | `ConfirmDialog` + `FormModal`/`Dialog` |
| Chips/badges hechos a mano (`View`+`Text` presionables) | `chips-categorias.tsx` (2 Pressable), `selector-proveedor.tsx` (2), `nav-inferior.tsx` (2) | `Chip` (Badge no es presionable) |
| Botones con `Pressable` + estilo inline (sin usar `ui/Button`, que sí tiene `size="icon"`) | `nav-lateral.tsx` (6), `tarjeta-producto.tsx` (5), `encabezado.tsx` (4), `solicitud.tsx` (5), `acceso.tsx` (3), `registro.tsx` (3), `nav-inferior.tsx` (2), `chips-categorias.tsx` (2), `tarjeta-cliente.tsx` (2), `selector-proveedor.tsx` (2), varios admin (2-5) | `IconButton` (adopción de `Button size="icon"`) |
| Estados vacíos ("No hay…" / "No tienes…") | `solicitud.tsx` (12), `pedidos/index.tsx` (2), `pedidos/[id].tsx` (2), `comerciales.tsx` (1), `proveedores.tsx` (1), `catalogo-screen.tsx` (1), `acceso.tsx` (1) — ~7 archivos, ~19 usos | `EmptyState` |
| Cargando/errores repetidos (`ActivityIndicator` + `Text` sueltos) | ~15 archivos con 2-3 usos cada uno (`cartera/*`, `catalogo/*`, `pedidos/*`, `admin/*`, `acceso.tsx`, `registro.tsx`) | `LoadingView` / `ErrorView` (unificar con `Skeleton`) |
| Filas icono + texto (detalle/listados) | `pedidos/[id].tsx`, `cartera/[id].tsx`, `catalogo/[id].tsx`, `tarjeta-cliente.tsx` (patrón `flex-row items-center gap-*`) | `FilaDetalle` |
| Formularios con `Label`+`Input`+mensaje de error ad hoc | `acceso.tsx`, `registro.tsx`, `admin/proveedores.tsx`, `admin/comerciales.tsx`, `admin/promociones.tsx` (Label solo en 3 archivos) | `FormField` |
| Duplicación explícita de lógica UI | `iconoProveedor()` duplicada en `admin/proveedores.tsx` y `admin/comerciales.tsx` (el comentario del archivo lo admite) | helper común (`src/lib/iconos-proveedor.ts`) |

**Señales buenas** (verificadas): cero `router.back()` sueltos (`volverA` en ~7
pantallas admin), cero colores HEX literales en pantallas (solo `_layout.tsx`
para `SystemUI` y `theme.ts`/`colores-proveedor.ts` como única fuente), y los
tokens hsl viven solo en `theme.ts`.

## 3. Propuesta de sistema de diseño

**Regla de uso** (a implantar): *ninguna pantalla define cards, cabeceras,
modales ni estados vacíos a mano; solo composición de primitivas + tokens.*

### Primitivas nuevas (`src/components/ui` o `src/components/comunes`)

| Primitiva | API sugerida |
|---|---|
| `Screen` | `{ children, scroll?: boolean, insets?: boolean }` — SafeArea + `ScrollView` + padding vertical coherente |
| `ScreenHeader` | `{ titulo, subtitulo?, volver?: boolean, respaldo?: string, acciones?: ReactNode }` — usa `volverA(respaldo)` |
| `EmptyState` | `{ icono?: LucideIcon, titulo, descripcion?, accion?: { etiqueta: string, onPress: () => void } }` |
| `LoadingView` / `ErrorView` | `{ etiqueta? }` / `{ mensaje, onReintentar? }` — sustituyen ActivityIndicator+Text |
| `ConfirmDialog` | `{ abierto, titulo, descripcion, peligro?, confirmarEtiqueta?, onConfirmar, onCancelar }` (basado en `Modal`) |
| `FormModal` | `{ abierto, titulo, onCerrar, children, footer?: ReactNode }` — modal de formulario con overlay y cierre accesible |
| `Chip` | `{ etiqueta, seleccionado?, onPress?, icono? }` — chip presionable (hoy `Badge` es solo vista) |
| `IconButton` | `{ icono, onPress, accesibleLabel, variante? }` — composición de `Button size="icon"` |
| `StatCard` | `{ titulo, valor, icono?, tinte? }` — tarjetas de estadísticas de `admin/index.tsx` |
| `FilaDetalle` | `{ icono?, titulo, subtitulo?, derecha?: ReactNode }` — filas icono+texto |
| `FormField` | `{ label, error?, children }` — `Label` + control + mensaje de error consistente |
| `Seccion` | `{ titulo, accion?: ReactNode, children }` — títulos de sección de listados |
| helpers | `iconoProveedor()` en `src/lib/iconos-proveedor.ts` (elimina la duplicación actual) y uso de `temaProveedor()` de `src/lib/colores-proveedor.ts` |

### Decisiones de tokens pendientes

| Área | Hoy | Decisión propuesta |
|---|---|---|
| Radios | Mezcla: `rounded-md` (Button, 6px), `rounded-[10px]` (pantallas), `rounded-xl` (Card, 12px), `rounded-full` (Badge) | Escala explícita: `sm` 6px / `md` 10px / `lg` 12px / `full`; migrar `rounded-[10px]` → token |
| Espaciado | `gap-1..6`, `p-4`, `px-6`, `py-6` mezclados sin criterio | Escala 4/8/12/16/24 (p-4, p-6) documentada |
| Tipografía | `Text` tiene h1-h4 pero `acceso.tsx`/`registro.tsx` usan `className="text-2xl/3xl"` sueltos | Obligar `variant` de `Text` para títulos |
| Estados | loading/empty/error sin primitiva; `Skeleton` 1 solo uso | `LoadingView`/`EmptyState`/`ErrorView` como únicos estados |
| Color | 3 fuentes sincronizadas a mano: `global.css` (NativeWind), `theme.ts` (THEME/NAV_THEME), `COLORES_ICONO` (lucide nativo); primario verde `#415D43`; proveedores Eider `#E1680F` / Fansa `#6FC2B9` vía `temaProveedor()` | Centralizar en un único módulo de tokens (o generación) para evitar deriva; los colores de proveedor SIEMPRE vía `temaProveedor()` |

## 4. Plan de unificación en 3 pasos

1. **Congelar tokens** (sin tocar pantallas): definir radios/espaciado/tipografía
   en `global.css`, centralizar la paleta (una fuente para NativeWind + nav +
   iconos), documentar en `docs/DESIGN.md`, y sustituir `rounded-[10px]` por el
   token de radio. Verificación: grep de `rounded-\[` = 0 en pantallas.
2. **Crear primitivas transversales**: `Screen`, `ScreenHeader`, `EmptyState`,
   `LoadingView`/`ErrorView`, `ConfirmDialog`, `IconButton`, `Chip`, `FormField`,
   `StatCard`, `FilaDetalle` y los helpers (`iconos-proveedor`). Adoptar primero
   en `src/app/admin/*` (8 pantallas, el patrón más homogéneo) y medir la
   reducción de líneas duplicadas.
3. **Migrar por feature**: catálogo (`tarjeta-producto`, `chips-categorias`,
   `selector-proveedor`, `encabezado`), pedidos/cartera (estados vacíos, filas,
   resúmenes) y acceso/registro (formularios). Añadir regla en CodeRabbit/docs:
   no literales de color, no modales/cards/cabeceras a mano, `volverA` siempre.
