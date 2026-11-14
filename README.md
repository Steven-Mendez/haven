# HAVEN

Monitoreo de salud para tripulaciones en misiones espaciales (NASA Space Apps 2026). El astronauta lleva la app en el teléfono y en el Apple Watch; el equipo en Tierra sigue a la tripulación desde la web.

HAVEN es una herramienta de apoyo a la decisión. No es un dispositivo médico y no tiene afiliación con la NASA.

Vista de Tierra desplegada: <https://haven-eta-gray.vercel.app>

| Pieza | Qué es | Dónde |
|---|---|---|
| Vista de Tierra | Web y API: misiones, tripulación, reglas, tendencias y paquetes recibidos | `apps/web` |
| App del astronauta | Rutina, indicadores, cognición, emergencias y cola de envío a Tierra | `apps/mobile` |
| Reloj | Monitor de frecuencia cardíaca y alarma de emergencia (SOS) | `apps/mobile/targets/watch` |
| Core | Contratos, motor de reglas y configuración versionada que comparten todos | `packages/core` |

## Estructura

```
apps/
  web/                    Next.js 16: API y Vista de Tierra
    src/app/              rutas y API (/api/*)
    src/features/<x>/     astronaut, crew, extras, settings
    src/server/           MongoDB, modelo y utilidades HTTP
    scripts/              seed y pruebas de la API
  mobile/                 Expo SDK 58 (iOS y Android)
    src/app/              rutas de Expo Router; cada una reexporta su feature
    src/features/<x>/     una carpeta por feature
    src/shared/           UI, datos locales, i18n y servicios comunes
    targets/watch/        app de Apple Watch en SwiftUI
    targets/watch-widget/ complicación del reloj
    modules/haven-watch/  módulo nativo que conecta el iPhone con el reloj
packages/
  core/                   src/contracts, src/engine, src/config y config/*.json
scripts/
  new-feature.mjs         generador de features
  sim/                    utilidades para los simuladores de iOS y watchOS
```

## Stack

| Pieza | Herramientas |
|---|---|
| Monorepo | pnpm 12 workspaces (`nodeLinker: hoisted`, lo pide React Native) y Turborepo |
| Web | Next.js 16 (Turbopack, Cache Components), Tailwind 4, shadcn/ui sobre Base UI, driver oficial `mongodb` |
| Base de datos | MongoDB Atlas; MongoDB 8 en Docker como alternativa sin internet |
| Despliegue | Vercel, con `apps/web` como directorio raíz |
| Móvil | Expo SDK 58, Expo Router, NativeWind 4, React Native Reusables, SQLite local |
| Reloj | SwiftUI; el target lo genera `@bacons/apple-targets` en cada prebuild |
| Lint y formato | Biome 2 para TS, JSX, JSON y CSS; `swift-format` para Swift |
| Hooks de git | Lefthook: Biome y swift-format en `pre-commit`; typecheck y tests en `pre-push` |
| Tests | Vitest en `packages/core` y en la lógica pura del móvil |
| CI | GitHub Actions: lint, typecheck y tests en cada push y pull request |

## Requisitos

- Node 24 (`.nvmrc`) y pnpm 12 (`corepack enable`).
- Acceso al clúster de MongoDB Atlas, o Docker para usar MongoDB local.
- iOS y reloj: macOS con Xcode y CocoaPods.
- Android: Android Studio, con `JAVA_HOME` y `ANDROID_HOME` exportados.

## Primeros pasos

```bash
pnpm install                                    # instala dependencias y los hooks de git
cp apps/web/.env.example apps/web/.env.local    # pon el MONGODB_URI de Atlas
cp apps/mobile/.env.example apps/mobile/.env    # pon la dirección de Tierra
pnpm dev:web                                    # http://localhost:3000
curl localhost:3000/api/health                  # {"ok":true,"mongo":"connected"}
```

## Variables de entorno

Los archivos `.env*` no se versionan; solo los `.env.example`, que documentan cada variable.

### Web: `apps/web/.env.local`

| Variable | Obligatoria | Para qué |
|---|---|---|
| `MONGODB_URI` | Sí | Cadena de conexión de Atlas |
| `MONGODB_DB` | No | Nombre de la base de datos; por defecto `haven` |
| `MONGODB_USE_LOCAL` | No | Con `true` usa `MONGODB_LOCAL_URI` en vez de Atlas |
| `MONGODB_LOCAL_URI` | No | MongoDB local; por defecto `mongodb://localhost:27017` |
| `HAVEN_PUBLIC_URL` | No | Dirección de Tierra que va en el QR de invitación; por defecto, el host de la página |

Para trabajar sin internet: `MONGODB_USE_LOCAL=true` y `pnpm db:up`.

### Móvil: `apps/mobile/.env`

| Variable | Obligatoria | Para qué |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | No | Dirección de Tierra inicial, normalmente `https://haven-eta-gray.vercel.app`; por defecto `http://localhost:3000` |

Es solo el valor inicial: al unirse a una misión por QR o código, la app guarda la dirección de la invitación, y también se puede cambiar en Ajustes. Expo incrusta las variables `EXPO_PUBLIC_*` al compilar el bundle, así que no deben contener secretos y hay que reiniciar Metro (`pnpm start -c`) al cambiarlas.

### Vercel

El proyecto de Vercel usa `apps/web` como directorio raíz y las mismas variables que `apps/web/.env.local`: `MONGODB_URI` y, si no es `haven`, `MONGODB_DB`. `MONGODB_USE_LOCAL` no debe activarse ahí. En Atlas, el acceso de red tiene que permitir las conexiones desde Vercel.

## Web (Vista de Tierra)

```bash
pnpm dev:web                 # escucha en 0.0.0.0, también para teléfonos en la red local
pnpm --filter web build      # compilación de producción
pnpm --filter web seed       # siembra la misión de ejemplo Ares-1 (código ARES01)
pnpm --filter web test:api   # prueba la API contra un servidor en marcha
```

`seed` y `test:api` leen `apps/web/.env.local`, así que escriben en la misma base de datos que la web: en Atlas, salvo que `MONGODB_USE_LOCAL=true`. `test:api` usa `http://localhost:3000` y se puede apuntar a otro servidor con `API_URL`.

Añadir componentes de shadcn: `cd apps/web && pnpm dlx shadcn@latest add <componente>`.

### API

| Ruta | Uso |
|---|---|
| `GET /api/health` | Comprueba que la API responde y que MongoDB está accesible |
| `/api/missions` | Misiones y sus fases |
| `/api/crew` | Tripulación de una misión |
| `/api/astronaut/[id]` | Detalle de un astronauta y sus paquetes |
| `/api/packets` | Paquetes que envía la app del astronauta |
| `/api/rules` | Reglas vigentes para una misión |
| `/api/aggregates` | Agregados para las tendencias de la tripulación |

## Móvil

La app usa librerías nativas, así que se trabaja con una compilación de desarrollo, no con Expo Go.

```bash
cd apps/mobile
pnpm ios        # prebuild, compila y abre el simulador
pnpm android
pnpm start      # solo Metro, para una compilación ya instalada
```

`ios/` y `android/` no se versionan: se regeneran con `pnpm prebuild`. La configuración nativa va en `app.json` o en config plugins.

Instalar paquetes con `npx expo install <paquete>`, que elige la versión compatible con el SDK. Añadir componentes de React Native Reusables: `npx @react-native-reusables/cli@latest add <componente>`.

### Enlace con Tierra

1. En la web, crear la misión y su tripulación.
2. En la página de tripulación, mostrar el QR o el código de invitación del astronauta.
3. En la app, unirse escaneando el QR o escribiendo el código.

A partir de ahí la app envía sus paquetes a `/api/packets`. Sin conexión los guarda en una cola local y los envía cuando vuelve el enlace.

### Apple Watch

El código vive en `apps/mobile/targets/watch/` y el prebuild lo añade como target dentro del proyecto de iOS. Para trabajarlo: `pnpm prebuild` y abrir `apps/mobile/ios/HAVEN.xcworkspace` en Xcode; el esquema `HAVEN` compila e incrusta el reloj. Lo que se edite en Xcode fuera de `targets/` se pierde en el siguiente prebuild.

Para instalar en dispositivos reales hay que poner el Team ID de Apple en `ios.appleTeamId` de `apps/mobile/app.json`.

### EAS

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
```

## Probar en simuladores

`scripts/sim/sim.sh` automatiza los simuladores de iOS y watchOS: reservar un par iPhone + Apple Watch, abrir rutas, tocar, escribir, capturar pantalla y grabar video.

```bash
pnpm dev:web
pnpm --filter web seed
cd apps/mobile && npx expo start --port 8081 --dev-client
scripts/sim/sim.sh acquire watch
scripts/sim/sim.sh status
```

Recorrido de punta a punta: SOS en el reloj → el iPhone abre el triaje con la frecuencia cardíaca del reloj → «Terminar» → el paquete aparece en Tierra en `/astronaut/<id>?tab=packets`.

## Comandos de la raíz

| Comando | Qué hace |
|---|---|
| `pnpm dev:web` | Arranca la web en `localhost:3000` |
| `pnpm dev:mobile` | Arranca Metro para la app móvil |
| `pnpm build` | Compila la web |
| `pnpm lint` / `pnpm lint:fix` | Biome en todo el repo |
| `pnpm format` | Formatea con Biome |
| `pnpm lint:swift` / `pnpm format:swift` | swift-format sobre `apps/mobile/targets` |
| `pnpm typecheck` | TypeScript en todos los paquetes |
| `pnpm test` | Tests de core y del móvil |
| `pnpm db:up` / `pnpm db:down` | Levanta o para MongoDB local en Docker |
| `pnpm feature <mobile\|web> <carpeta> <ID> "<título es>" "<título en>"` | Crea una feature con su estructura |

## Cómo trabajamos

- Una feature por carpeta, de punta a punta, con un responsable.
- Las features no comparten archivos; lo común vive en `packages/core` o en `shared/`.
- Umbrales, textos y protocolos salen de la configuración de `packages/core/config`, no del código.
- Textos en español e inglés.
- La app funciona sin conexión; «sin datos» nunca se muestra como «normal».
- Ramas cortas hacia `main`, con lint, typecheck y tests en verde.

## Licencia

Apache 2.0, ver [LICENSE](LICENSE).
