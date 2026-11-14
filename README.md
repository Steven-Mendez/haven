# HAVEN — starter de hackatón

Monorepo con pnpm workspaces:

| Ruta | Qué es | Stack |
|---|---|---|
| `apps/web` | Web + API | Next.js 16 (App Router), Tailwind v4, **shadcn/ui** |
| `apps/mobile` | App iOS | Expo SDK 56 + Expo Router, NativeWind, **React Native Reusables** (shadcn para RN) |
| `apps/mobile/targets/watch` | App watchOS | SwiftUI nativo, inyectado al proyecto Xcode con `@bacons/apple-targets` |
| `packages/shared` | Tipos TS compartidos | — |
| `docker-compose.yml` | MongoDB local | mongo:8 |

## Arquitectura

```
 Web (Next.js) ─┐
 iOS (Expo) ────┼──► Next.js API routes (/api/*) ──► MongoDB
 watchOS (Swift)┘
```

Solo el servidor de Next.js habla con Mongo; las apps iOS y watchOS consumen la API por HTTP.
**No metas el driver de Mongo en la app móvil.**

## Arranque rápido

```bash
pnpm install
pnpm db:up                 # Mongo en Docker (o pon tu URI de Atlas en apps/web/.env.local)
pnpm dev:web               # http://localhost:3000  — API en /api/items
pnpm ios                   # compila la app iOS + watch (requiere Xcode)
```

`pnpm ios` corre `expo run:ios`, que hace prebuild y genera `apps/mobile/ios` con el target del Watch.
Para correr el Watch: abre `apps/mobile/ios/*.xcworkspace` en Xcode, elige el scheme **HavenWatch** y un simulador de Apple Watch.

> Como hay un target de watchOS, la app necesita un **development build**; Expo Go no sirve.

## Variables de entorno

- `apps/web/.env.local` → `MONGODB_URI`, `MONGODB_DB`
- `apps/mobile/.env` → `EXPO_PUBLIC_API_URL` (en un iPhone físico usa la IP LAN de tu Mac)
- Watch: constante `API_URL` en `targets/watch/ContentView.swift`

## Agregar componentes

```bash
# Web (shadcn/ui)
cd apps/web && pnpm dlx shadcn@latest add dialog input

# Mobile (React Native Reusables)
cd apps/mobile && npx @react-native-reusables/cli@latest add input dialog
```

## Firma en dispositivo real

Agrega `"appleTeamId": "XXXXXXXXXX"` en `expo.ios` de `apps/mobile/app.json` (lo usa `@bacons/apple-targets` para el target del Watch).
