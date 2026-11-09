# Publicación de la beta Android (EAS Build)

Guía para generar el APK de la beta con **EAS Build** (Expo Application
Services) y probarlo en un móvil Android.

## Qué es EAS

EAS es el servicio de builds en la nube de Expo: compila el APK/AAB en sus
servidores (sin necesidad de Android Studio en local) y te da un enlace para
descargar e instalar la app. Perfiles usados en este repo (`eas.json`):

- **preview**: APK de distribución interna (para instalarlo directamente).
- **production**: build de producción (AAB para Play Store), con las mismas
  variables de entorno.

Ambos perfiles inyectan en tiempo de build las claves de **Supabase Cloud**:

- `EXPO_PUBLIC_SUPABASE_URL` = `https://bvulkrggcicftjalfctz.supabase.co`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_l6ITyPAxeK5XxHizqelw-Q_vaBsbueD`

(`src/shared/constantes/index.ts` ya lee ambas variables; sin ellas la app
usaría el Supabase local de desarrollo.)

## Requisitos

1. Cuenta en <https://expo.dev> (ya creada).
2. Sesión iniciada una vez en el terminal de desarrollo:
   `npx eas-cli login` (ya hecho; la sesión vive en el perfil del usuario).
3. Proyecto vinculado a EAS (escribe el `projectId` en `app.json`):
   `npx eas-cli init` — pendiente de ejecutar a mano (ver nota final).

## Pasos

1. Vincular el proyecto (una sola vez):
   `npx eas-cli init`
2. Lanzar el build de la beta:
   `npx eas-cli build -p android --profile preview`
3. Cuando termine, EAS muestra un enlace de descarga. También se puede
   consultar en: `npx eas-cli build:list` o en la web de Expo
   (<https://expo.dev/accounts/adolecumberri/projects>).

## Instalar el APK en el móvil

1. Descargar el APK desde el enlace de EAS (o escanear el QR).
2. Al abrirlo, Android pedirá **permitir instalar apps desconocidas**
   (Ajustes → permitir para el navegador/archivos).
3. Instalar y abrir "Brasa y Verde".

## Advertencias

- El APK apunta a **Supabase Cloud**
  (`https://bvulkrggcicftjalfctz.supabase.co`), no al stack local.
- ⚠️ Antes de probar la beta, la **BD de Supabase Cloud debe estar migrada**
  (migraciones `0001`-`0026` aplicadas y seed cargado). Sin eso, la app
  arrancará pero el catálogo, los pedidos y el login no funcionarán.
- `android.package` = `com.brasayverde` (identificador del APK).

## Nota pendiente (a ejecutar por el usuario)

`npx eas-cli init` no se pudo ejecutar desde el entorno del agente: el CLI de
EAS lanza el CLI de Expo como subproceso y el sandbox de trabajo lo bloquea
(`spawn EPERM`). Ejecútalo a mano una vez (elige la cuenta **estufas** o la
personal según prefieras); dejará `extra.eas.projectId` (y el `owner`) en
`app.json`. Después, el build se lanza con:

```
npx eas-cli build -p android --profile preview
```
