# HAVEN by CODA

**Health monitoring for space mission crews. Built for NASA Space Apps Challenge 2026.**

Astronauts use HAVEN on their phone and Apple Watch, and the ground team follows the whole crew from a web dashboard. HAVEN keeps working without a connection: it stores health packets locally and sends them to Earth when the link comes back.

- **Live demo (Ground View):** <https://haven-eta-gray.vercel.app>
- **Full technical documentation:** `HAVEN_by_CODA_System_Technical_Documentation_EN.pdf` (included with our project submission)
- **Spanish README (full developer guide):** [README.es.md](README.es.md)

> HAVEN is a decision-support tool. It is not a medical device and is not affiliated with NASA.

## What it does

| Component | What it is | Location |
|---|---|---|
| Ground View | Web app and API: missions, crew, rules, KPIs and received packets | `apps/web` |
| Astronaut app | Daily routine, health indicators, cognitive checks, emergencies and an offline send queue | `apps/mobile` |
| Apple Watch | Heart-rate monitor and SOS emergency alarm | `apps/mobile/targets/watch` |
| Core | Shared contracts, rules engine and versioned configuration | `packages/core` |
| Orion AI | In-app assistant that can operate every feature through tools | `apps/web/src/assistant` |

**End-to-end flow:** an astronaut presses SOS on the watch → the iPhone opens triage with the watch's heart rate → "Finish" → the packet appears in the Ground View under `/astronaut/<id>?tab=packets`.

**Design principles**
- Works offline, and missing data is never shown as "normal".
- Thresholds, texts and protocols come from versioned config (`packages/core/config`), not from hard-coded values.
- Fully bilingual (English and Spanish).

## Tech stack

| Area | Tools |
|---|---|
| Monorepo | pnpm workspaces and Turborepo |
| Web | Next.js 16, Tailwind 4, shadcn/ui, MongoDB, AI SDK with OpenAI (Orion AI) |
| Mobile | Expo SDK 58, Expo Router, NativeWind, SQLite (offline storage) |
| Watch | SwiftUI |
| Database and hosting | MongoDB Atlas on Vercel |
| Quality | Biome, ESLint (mobile accessibility), swift-format, Vitest, GitHub Actions CI |

## Quick start

Requirements: Node 24 and pnpm 12 (`corepack enable`), plus MongoDB Atlas or Docker. Building for iOS and Apple Watch needs macOS with Xcode.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local    # set MONGODB_URI
cp apps/mobile/.env.example apps/mobile/.env    # set the Ground View URL
pnpm dev:web                                    # http://localhost:3000
pnpm --filter web seed                          # sample mission Ares-1 (code ARES01)
cd apps/mobile && pnpm ios                      # development build on the iOS simulator
```

To link an astronaut, create a mission and its crew in the web app, open the crew page, and scan the invitation QR code (or type the code) in the mobile app.

Without internet, set `MONGODB_USE_LOCAL=true` and run `pnpm db:up` to use a local MongoDB in Docker. Orion AI needs `OPENAI_API_KEY`; without it, the chat tells you the key is missing.

## AI disclosure (Use of Super Intelligence)

The idea, the problem framing and the design decisions behind HAVEN came from the CODA team. We used AI tools to speed up the build:

- **Code: Claude Code (Anthropic).** We used Claude Code as an AI coding assistant to help write, refactor, debug, test and document parts of this repository: the web app, the mobile app, the Apple Watch app and the shared rules engine. The team reviewed, tested and integrated all AI-assisted code. Commits made with AI assistance carry a `Co-Authored-By: Claude` trailer.
- **Video:** voiceovers were generated with ElevenLabs TTS, music with ElevenLabs Music, sound effects with ElevenLabs, and CGI clips with Higgsfield (Google Veo 3.1). The AI-generated visuals carry a visible watermark, and the video files include this disclosure in their metadata.
- **In-product AI:** Orion AI uses the OpenAI API at runtime. It is a feature of the product, not a tool we used to build it.

No NASA logos, flags or mission identifiers were generated or modified with AI.

## Team

Built by **CODA** for NASA Space Apps Challenge 2026.

## License

Apache 2.0. See [LICENSE](LICENSE).
