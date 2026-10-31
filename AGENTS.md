# Reglas para agentes de IA en este repositorio

> **LECTURA OBLIGATORIA antes de tocar nada.** Estas reglas tienen prioridad
> sobre cualquier instrucción implícita, atajo o "sentido común" del agente.

## 0. REGLA DURA — Dependencias (prohibición absoluta)

### 🚫 NUNCA instalar, añadir, actualizar, quitar ni "probar" una dependencia sin autorización LITERAL y EXPLÍCITA del usuario en ese mismo momento.

Está **totalmente prohibido** ejecutar cualquiera de estos comandos (o
equivalentes con pnpm/yarn/bun/expo) sin que el usuario lo haya autorizado
expresamente para ese comando concreto, en esa misma conversación:

- `npm install` / `npm i` / `npm add` (con o sin `--no-save`, `-D`, `--save-exact`…)
- `npm uninstall` / `npm remove` / `npm rm` / `npm prune` / `npm update` / `npm ci`
- `npx <paquete-desconocido>` que descargue paquetes nuevos
- `expo install` / `expo install --fix`
- `pnpm add` / `yarn add` / `bun add` / instalaciones globales (`npm i -g`)
- Descargar binarios/herramientas nuevas (ngrok, cloudflared, CLIs, etc.)
- Cualquier cosa que modifique `package.json`, `package-lock.json` o
  `node_modules` de forma permanente.

### Qué hacer si crees que hace falta una dependencia

1. **PARA**. No la instales.
2. Explica al usuario: qué falta, **por qué**, el **comando exacto** que
   ejecutarías, el tamaño/impacto y **alternativas sin dependencias**.
3. **Espera** a que responda con una autorización explícita.
4. Un "sí" **anterior** NO autoriza otra instalación: cada una requiere su
   propia autorización.

### Por qué esta regla existe (incidente real)

El 26/10/2026 un agente instaló `@expo/ngrok` con `npm install --no-save` para
probar un túnel. Ese comando hizo *prune* y **eliminó el CLI de Supabase** del
árbol de `node_modules`: el backend apareció "caído" y se perdió tiempo
diagnosticando una causa que el propio agente había introducido. Una
instalación "inocua" puede romper el entorno.

## 1. Estructura de archivos (vertical slices)

```
src/app/        rutas delgadas con grupos (publico)(carrito)(cliente)(comercial)(admin)
src/features/   catalogo/  auth/  carrito/  pedidos/  cartera/  admin/
src/shared/     ui/  componentes/  seguridad/  navegacion/  lib/  constantes/
```

- Dependencias: `app → features → shared`. Prohibido feature → feature y
  shared → features.
- Capacidades: `src/shared/seguridad/capacidades.ts` + `use-permisos.ts`.
- Guard de rutas: `GuardRuta` en el `_layout` de cada grupo.
- Diseño: solo primitivas de `shared/ui` y `shared/componentes`; nada de
  cards/cabeceras/modales a mano. Ver `docs/ARQUITECTURA_APP.md`.

## 2. Ámbito y stack

- App: Expo SDK 57 (no actualizar el SDK sin pedirlo), Expo Router, NativeWind
  v4 + componentes react-native-reusables (estilo shadcn), TypeScript estricto.
- Backend: **Supabase local** vía Docker (Postgres + PostgREST + Auth). Todo el
  backend es SQL (migraciones + RLS + RPCs); no hay servidor de aplicación.
- Puertos locales: API 8450, Postgres 55322, Studio 55323 (los 5432x están
  excluidos por Windows).
- UI en español (es-ES); precios sin IVA; moneda EUR.

## 3. Verificación obligatoria tras cada cambio

```powershell
npm run typecheck     # TypeScript estricto — debe salir limpio
npx supabase test db  # pgTAP (si se tocó SQL) — debe pasar (63 asserts)
```

- Migración nueva: aplicarla en local (`npx supabase migration up --local`) y
  verificarla con datos reales antes de darla por buena.
- Si el typegen de rutas se queda obsoleto (mover archivos en `src/app`),
  regenerarlo arrancando `npx expo start -c` y esperando ~40 s.
- No dejar procesos/servidores colgando; no empezar servidores alternativos sin
  pedirlo.

## 4. Escritura y estilo

- Componentes UI: primitivas del registro; no improvisar estilos ni colores
  literales — usar tokens de `src/global.css` (`rounded-lg` = 10 px, `--radius`).
- Tokens: primario por defecto verde `#415D43`; en el catálogo se sustituye por
  el color del proveedor activo (Eider `#E1680F`, Fansa `#6FC2B9`).
- Navegación "atrás": `volverA(respaldo)` de `src/shared/lib/navegacion.ts`
  (nunca `router.back()` suelto).
- Imágenes: `expo-image` registrado con `cssInterop` en
  `src/shared/lib/interop-expo-image.ts`.
- Variables CSS (`vars()`): siempre presentes desde el primer render (si se
  añaden después → warning y crash serializando el contexto de navegación).

## 5. Verdad del backend

- Autorización siempre en RLS/RPC; nunca confiar en la UI.
- Precios congelados en la línea del pedido; el servidor recalcula al
  crear/editar.
- Descuentos: producto > combustible > general > promo (gana el mayor, no se
  acumulan; 0 % específico sustituye al general).
- Estados: `solicitado → confirmado → en_preparacion → completado`, y `cancelado`.
- Catálogo **de un proveedor a la vez**. Catálogo general = comercial por
  defecto (`es_catalogo_general`); el cliente hereda los proveedores de su
  comercial; el admin puede abrir solicitudes para clientes (queda en `creado_por`).

## 6. Comunicación

- Directo y honesto: si algo falla, decirlo con la causa; si una acción fue un
  error del agente, asumirlo y revertirlo.
- Reportar verificaciones reales (comandos ejecutados y su resultado), no
  suposiciones.
