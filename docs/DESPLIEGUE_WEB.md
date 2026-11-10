# Despliegue web — GitHub Pages

La app web (SPA, `web.output: "single"` en `app.json`) se publica en GitHub
Pages desde la rama `main` mediante el workflow
`.github/workflows/deploy-pages.yml`.

## Qué hace el workflow

En cada push a `main` (o manual desde la pestaña Actions → "Deploy web a
GitHub Pages" → "Run workflow"):

1. `actions/checkout@v4` + `actions/setup-node@v4` (Node 20, cache npm).
2. `npm ci`.
3. `npx expo export --platform web` con las variables del **Supabase Cloud**
   (`EXPO_PUBLIC_SUPABASE_URL=https://bvulkrggcicftjalfctz.supabase.co`,
   `EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...`).
4. Prepara `dist/` para Pages: copia `index.html` → `404.html` (deep links
   SPA: cualquier ruta cae en la SPA) y crea `.nojekyll` (Metro genera
   carpetas con `_` que Jekyll ignoraría).
5. `configure-pages@v5`, `upload-pages-artifact@v3` y `deploy-pages@v4` con
   `permissions: pages: write, id-token: write` y `concurrency`.

El subpath se sirve gracias a `experiments.baseUrl: "/estufas/"` en
`app.json` (opción documentada de Expo para alojar bajo una subruta; el
export muestra "Using (experimental) base path: /estufas").

## Pasos que debe hacer el usuario en GitHub (una vez)

1. Repo **público**: Settings → Pages.
2. **Source: GitHub Actions** (en "Build and deployment").
3. Confirmar el **Environment** `github-pages` que crea el workflow.
4. Ir a Actions → "Deploy web a GitHub Pages" → "Run workflow" (o hacer un
   push a `main`).

URL esperada: <https://adolecumberri.github.io/estufas/>

## Forzar un redeploy

- Actions → "Deploy web a GitHub Pages" → **Run workflow** → rama `main`, o
- cualquier push a `main`.

## Advertencias

- La web apunta al **Supabase Cloud** (proyecto `bvulkrggcicftjalfctz`): usa
  los **datos demo reales** (usuarios de prueba y catálogo). No es un
  entorno de pruebas aislado.
- Es una SPA: rutas como `/estufas/pedidos/…` funcionan por el `404.html`;
  si GitHub Pages no sirve un refresco directo, revisar que `404.html` esté
  en el artefacto.
- Verificación local: `npx expo export --platform web` (con las dos
  `EXPO_PUBLIC_*`) y `npx expo serve`. Nota del entorno del agente: el
  export local falla dentro del sandbox de trabajo (`spawn EPERM` al lanzar
  los workers de Metro); se ejecuta sin problema en GitHub Actions.
