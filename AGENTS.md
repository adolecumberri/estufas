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
- `npx <paquete-desconocido>` que descargue paquetes nuevos (respeta y pregunta)
- `expo install` / `expo install --fix`
- `pnpm add` / `yarn add` / `bun add` / instalaciones globales (`npm i -g`)
- Descargar binarios/herramientas nuevas (ngrok, cloudflared, CLIs, etc.)
- Cualquier cosa que modifique `package.json`, `package-lock.json` o
  `node_modules` de forma permanente.

### Qué hacer si crees que hace falta una dependencia

1. **PARA**. No la instales.
2. Explica al usuario: qué falta, **por qué**, el **comando exacto** que
   ejecutarías, el tamaño/impacto y **alternativas sin dependencias**.
3. **Espera** a que responda con una autorización explícita (p. ej. "sí,
   instálalo" / "autorizado").
4. Un "sí" **anterior** NO autoriza otra instalación, ni otra dependencia, ni
   la misma más tarde: cada instalación requiere su propia autorización.

### Por qué esta regla existe (incidente real)

El 26/10/2026 un agente instaló `@expo/ngrok` con `npm install --no-save` para
probar un túnel. Ese comando hizo *prune* de paquetes "extranjeros" y **eliminó
el CLI de Supabase** del árbol de `node_modules`. Días después el backend
aparecía "caído", el arranque de Supabase falló y se perdió tiempo
diagnosticando una causa que el propio agente había introducido. Además, la
instalación no solucionó nada (ngrok estaba bloqueado por la red).

Conclusión: una instalación "inocua" puede romper el entorno. Por eso **nunca**
se instala nada sin permiso explícito.

## 1. Ámbito y stack

- App: Expo SDK 57 (no actualizar el SDK sin pedirlo), Expo Router, NativeWind
  v4 + componentes react-native-reusables (estilo shadcn), TypeScript estricto.
- Backend: **Supabase local** vía Docker (Postgres + PostgREST + Auth). Todo el
  backend es SQL (migraciones + RLS + RPCs); no hay servidor de aplicación.
- UI en español (es-ES); precios sin IVA; moneda EUR.

## 2. Verificación obligatoria tras cada cambio

```powershell
npm run typecheck     # TypeScript estricto — debe salir limpio
npx supabase test db  # pgTAP (si se tocó SQL) — debe pasar
```

- Si se añadió una migración: aplicarla en local (`npx supabase migration up
  --local`) y verificarla con datos reales antes de dar el cambio por bueno.
- No dejar procesos/servidores colgando; no empezar servidores alternativos sin
  pedirlo.

## 3. Escritura y estilo

- Componentes UI: los del registro (react-native-reusables); no improvisar
  estilos nuevos ni colores literales — usar tokens de `src/global.css`.
- Tokens: primario por defecto verde `#415D43`; en el catálogo se sustituye por
  el color del proveedor activo (Eider ámbar `#E1680F`, Fansa teal `#6FC2B9`).
- Navegación "atrás": usar `volverA(respaldo)` de `src/lib/navegacion.ts`
  (nunca `router.back()` suelto).
- Imágenes: registrar `expo-image` con `cssInterop` (ya hecho en
  `src/lib/interop-expo-image.ts`).
- Variables CSS de NativeWind (`vars()`): deben existir **siempre desde el
  primer render** (si se añaden después → warning + crash serializando el
  contexto de navegación).

## 4. Verdad del backend

- Autorización siempre en RLS/RPC; nunca confiar en la UI.
- Precios: congelados en la línea del pedido; el servidor recalcula al
  crear/editar.
- Descuentos: producto > combustible > general > promo (gana el mayor, no se
  acumulan; 0% específico sustituye al general).
- Estados de pedido: `solicitado → confirmado → en_preparacion → completado`,
  más `cancelado`.
- El catálogo es **de un proveedor a la vez**.

## 5. Comunicación

- Directo y honesto: si algo falla, decirlo con la causa; si una acción fue un
  error del agente, asumirlo y revertirlo.
- Reportar verificaciones reales (comandos ejecutados y su resultado), no
  suposiciones.
