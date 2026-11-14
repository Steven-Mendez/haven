# HAVEN — starter de hackatón

Monorepo con pnpm workspaces:

| Ruta | Qué es | Stack |
|---|---|---|
| `apps/web` | Web + API | Next.js 16 (App Router), Tailwind v4, **shadcn/ui** |
| `apps/mobile` | App iOS | Expo SDK 58 + Expo Router, NativeWind, **React Native Reusables** (shadcn para RN) |
| `apps/mobile/targets/watch` | App watchOS | SwiftUI, añadida al proyecto iOS por `@bacons/apple-targets` en cada prebuild |
| `apps/mobile/modules/haven-watch` | Puente iPhone ↔ Watch | Módulo local de Expo (Swift, WatchConnectivity) |
| `packages/shared` | Tipos TS compartidos y contrato del Watch (`watch.ts`) | — |
| `docker-compose.yml` | MongoDB local | mongo:8 |

## Arquitectura

```
 Web (Next.js) ─┐
 iOS (Expo) ────┴──► Next.js API routes (/api/*) ──► MongoDB
     ▲
     │ WatchConnectivity (modules/haven-watch)
     ▼
 watchOS (SwiftUI)
```

- Solo Next.js habla con Mongo. **No metas el driver de Mongo en la app móvil.**
- El reloj no llama a la API: le manda acciones al iPhone y recibe el estado de vuelta.
- React Native no corre en watchOS: las pantallas del reloj son SwiftUI. Expo genera el target, lo compila y lo sube con la app del iPhone.

## Arranque rápido

```bash
pnpm install
pnpm db:up                 # Mongo en Docker (o pon tu URI de Atlas en apps/web/.env.local)
pnpm dev:web               # http://localhost:3000  — API en /api/items
pnpm ios                   # compila la app iOS + watch (requiere Xcode)
```

`pnpm ios` corre `expo run:ios`: prebuild, compila e instala el development build (`expo-dev-client`; Expo Go no sirve).
Para el reloj: `pnpm --filter mobile prebuild`, abre `apps/mobile/ios/HAVEN.xcworkspace`, elige el scheme **HavenWatch** y un simulador de Apple Watch emparejado con el del iPhone.

Lo que edites en Xcode fuera de `targets/` y `modules/` se pierde en el siguiente prebuild.

## Variables de entorno

- `apps/web/.env.local` → `MONGODB_URI`, `MONGODB_DB`
- `apps/mobile/.env` → `EXPO_PUBLIC_API_URL` (en un iPhone físico usa la IP LAN de tu Mac)
- Watch: no necesita; habla con el iPhone.

## Agregar componentes

```bash
# Web (shadcn/ui)
cd apps/web && pnpm dlx shadcn@latest add dialog input

# Mobile (React Native Reusables)
cd apps/mobile && npx @react-native-reusables/cli@latest add input dialog
```

## Apple Watch: dónde va cada cosa

| Qué | Dónde |
|---|---|
| Pantallas del reloj | `apps/mobile/targets/watch/Features/<feature>/` (SwiftUI) |
| Nuevo mensaje iPhone ↔ Watch | `packages/shared/src/watch.ts` **y** `targets/watch/Contract/Contract.swift` |
| Recibir o enviar en el reloj | `targets/watch/Bridge/WatchBridge.swift` |
| Recibir o enviar en el iPhone | `sendToWatch`, `useWatchMessages`, `useWatchReachable` de `@/lib/watch` |

Ejemplo de punta a punta: `app/index.tsx` y `targets/watch/Features/Items/ItemsView.swift`.

## EAS

```bash
cd apps/mobile
npx eas-cli@latest login && npx eas-cli@latest init
npx eas-cli@latest build --profile development --platform ios
```

Un solo build incluye el iPhone y el Watch. EAS Update solo actualiza JS: los cambios en Swift necesitan un build nuevo.

## Firma en dispositivo real

Agrega `"appleTeamId": "XXXXXXXXXX"` en `expo.ios` de `apps/mobile/app.json` (lo usa `@bacons/apple-targets` para el target del Watch).

## Notas (Xcode 27 / iOS 27)

- Se usa **Expo SDK 58** porque iOS 27 exige el ciclo de vida por escenas (UIScene); SDK 56 crashea al abrir.
- `apps/mobile/plugins/withPodsMinDeploymentTarget.js` sube a iOS 15.1 los pods que declaran un target menor (Xcode 27 los rechaza).
- pnpm usa `nodeLinker: hoisted` porque React Native necesita `node_modules` plano.
- `apps/mobile/ios/` se genera con `expo prebuild` y está en `.gitignore`.
