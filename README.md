# HAVEN

Monorepo del proyecto HAVEN (NASA Space Apps 2026). La documentación de producto vive en el vault de Obsidian (`../obsidian`); este repositorio sigue su [Arquitectura técnica](../obsidian/40%20Proyecto/05%20Arquitectura%20t%C3%A9cnica.md) y sus [Contratos compartidos](../obsidian/40%20Proyecto/04%20Contratos%20compartidos.md).

```
haven/
  apps/mobile/            React Native + Expo SDK 58 (iOS, Android y web de demo)
    src/app/              rutas de Expo Router: una línea que reexporta su feature
    src/features/<x>/     una carpeta por feature (M00…M10), un dueño cada una
    src/shared/           común del móvil: ui/ (React Native Reusables), bus de eventos, i18n, config
    targets/watch/        app de Apple Watch en Swift, una carpeta por feature (W00…W04)
  apps/web/             Next.js 16: API y Vista de Tierra; shadcn/ui; MongoDB
    src/features/<x>/     T01…T03
  packages/core/          contracts (tipos), engine (C01), simulator (C02), config JSON por dueño
  scripts/nueva-feature.mjs   generador: pnpm feature <mobile|earth> <folder> <ID> "<es>" "<en>"
```

## Stack

| Pieza | Herramientas |
|---|---|
| Monorepo | pnpm 12 workspaces (`nodeLinker: hoisted`, lo pide React Native), Turborepo |
| Lint y formato | Biome 2 (TS, JSX, JSON, CSS, orden de clases Tailwind) · `swift-format` (Swift) |
| Hooks de git | Lefthook: Biome y swift-format en `pre-commit`; typecheck y tests en `pre-push` |
| Móvil | Expo SDK 58, Expo Router, NativeWind 4 (Tailwind 3), React Native Reusables (shadcn para RN), lucide-react-native |
| Reloj | SwiftUI, watchOS 11+, target generado por `@bacons/apple-targets` en cada prebuild |
| Web | Next.js 16 (Turbopack, Cache Components), Tailwind 4, shadcn/ui (Base UI), driver oficial `mongodb` |
| Base de datos | MongoDB 8 local en Docker (`docker-compose.yml`), sirve en la red de la demo sin internet |
| Tests | Vitest en `packages/core` |

## Requisitos

- Node 24.16+ (`.nvmrc`) y pnpm 12 (`corepack enable` o `brew install pnpm`).
- MongoDB: Atlas (por defecto) o Docker para trabajar sin internet.
- iOS y reloj: macOS con Xcode 26.4+ y CocoaPods.
- Android: Android Studio (SDK y su JDK). Exporta `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` y `ANDROID_HOME="$HOME/Library/Android/sdk"`.

## Primeros pasos

```bash
pnpm install                       # también instala los hooks de git
cp apps/web/.env.example apps/web/.env.local   # pon el MONGODB_URI de Atlas (el mismo de Vercel)
# Sin internet: MONGODB_USE_LOCAL=true en .env.local y `pnpm db:up` (MongoDB en localhost:27017)
```

### Web (Vista de Tierra)

```bash
pnpm dev:web                     # http://localhost:3000, escucha en 0.0.0.0 para la red local
curl localhost:3000/api/health     # {"ok":true,"mongo":...}
pnpm --filter web seed    # siembra la misión Ares-1 (ARES01)
pnpm --filter web build
```

Añadir componentes de shadcn: `cd apps/web && pnpm dlx shadcn@latest add <componente>`.

### Móvil

El proyecto usa librerías nativas, así que se trabaja con una **compilación de desarrollo** (no Expo Go).

```bash
cd apps/mobile
pnpm ios                           # expo run:ios: prebuild + compila + abre el simulador
pnpm android                       # expo run:android
pnpm start                         # solo Metro, para una compilación de desarrollo ya instalada
pnpm web                           # versión web de demo (solo simulador)
```

`ios/` y `android/` **no se versionan**: se regeneran con `pnpm prebuild` (Continuous Native Generation). Toda configuración nativa va en `app.json` o en config plugins.

Instalar paquetes siempre con `npx expo install <paquete>` (elige la versión compatible con el SDK). Añadir componentes de React Native Reusables: `npx @react-native-reusables/cli@latest add <componente>`.

### Apple Watch

El código vive en `apps/mobile/targets/watch/` y el prebuild lo añade como target `HAVEN Watch` dentro del proyecto iOS (decisión del punto 4 de *Arquitectura técnica*). Para trabajarlo: `pnpm prebuild` y abrir `apps/mobile/ios/HAVEN.xcworkspace` en Xcode; el esquema `HAVEN` compila e incrusta el reloj. Lo editado en Xcode **fuera** de `targets/` se pierde en el siguiente prebuild.

Antes de instalar en dispositivos reales, poner el Team ID de Apple en `ios.appleTeamId` de `apps/mobile/app.json`.

### EAS

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init            # crea el proyecto y escribe extra.eas.projectId
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios --local   # iOS en la Mac, por las colas del plan gratuito
```

## Probar y hacer la demo (simuladores)

Todo se prueba en los simuladores de Xcode 27 (visibles en DeviceHub), no en el navegador. Detalles en la cabecera de `scripts/sim/sim.sh`.

```bash
pnpm dev:web                                   # API + Vista de Tierra en :3000
pnpm --filter web seed                  # datos de prueba de la misión Ares-1 (ARES01) en MongoDB
API_URL=http://localhost:3000 pnpm --filter web test:api
cd apps/mobile && npx expo start --port 8081 --dev-client   # Metro para los simuladores
scripts/sim/sim.sh acquire watch                 # par iPhone 17 Pro Max + Apple Watch Ultra 4 (instala la app)
scripts/sim/sim.sh open <udid> dev               # /dev (solo desarrollo): «Cargar datos de prueba» como registros
```

Demo de punta a punta: SOS en el reloj → el iPhone abre el triaje con la frecuencia cardíaca del reloj → «Terminar»
→ el paquete llega a la Tierra al instante (`/astronaut/<id>?tab=packets`) → el reloj cierra el monitor.
HAVEN es el producto real: nada en la interfaz es simulado y no hay retardo artificial; los datos de prueba son
registros (MongoDB, base local, HealthKit de los simuladores) cargados con herramientas solo de desarrollo.

## Comandos de la raíz

| Comando | Qué hace |
|---|---|
| `pnpm feature …` | Crea una feature con su estructura |
| `pnpm lint` / `pnpm lint:fix` | Biome en todo el repo, incluidas las fronteras entre features |
| `pnpm format` | Formatea con Biome |
| `pnpm lint:swift` / `pnpm format:swift` | swift-format sobre `apps/mobile/targets` |
| `pnpm typecheck` | TypeScript en todos los paquetes (Turborepo) |
| `pnpm test` | Tests de core (Vitest) y de la lógica pura del móvil |
| `pnpm lint:swift` | swift-format estricto sobre el reloj y el módulo nativo |
| `pnpm build` | Compila lo que tenga `build` (hoy, la web) |
| `pnpm db:up` / `pnpm db:down` | Levanta o para MongoDB |

## Forma de trabajo

Resumen de *Forma de trabajo* del vault: features verticales, dueño único, contratos congelados el primer día.

1. Una feature, una persona, de punta a punta.
2. Las features no comparten archivos; lo compartido está en `packages/core` y solo cambia por acuerdo anunciado en el Tablero.
3. Una feature en curso por persona.
4. La nota de feature es el prompt.
5. Integrar en `main` varias veces al día, con ramas cortas.
6. Lo que no existe se simula.
7. Orden por valor para el jurado.

### Definition of Done

- [ ] Funciona sin conexión; nada depende de un servidor.
- [ ] Textos en español e inglés, sin jerga médica sin explicar.
- [ ] Umbrales, textos y protocolos salen de la configuración versionada, no del código.
- [ ] Cada dato muestra fuente, antigüedad y si es simulado; «sin datos» nunca se ve como «normal».
- [ ] Detalles como pantallas, sin ventanas emergentes; objetivos táctiles grandes; usable con poca luz.
- [ ] Descargos visibles: apoyo a la decisión y no sustituto del cirujano de vuelo; no es un dispositivo médico; sin afiliación a la NASA.
- [ ] Fuentes de NASA citadas donde se muestre contenido médico o datos del OSDR.
- [ ] Lint y pruebas en verde; se demuestra en 60 segundos; solo tocó sus archivos o los contratos por acuerdo.

## Fuentes y uso de IA

Pendiente de P05 (*Video, pitch y repositorio*): fuentes citadas y declaración de uso de IA.

## Licencia

Apache 2.0, ver [LICENSE](LICENSE). HAVEN es una herramienta de apoyo a la decisión, no un dispositivo médico, y no tiene afiliación con la NASA.
