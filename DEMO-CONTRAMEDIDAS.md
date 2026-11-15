# Demo: contramedidas de reentrada y EVA

Rama de integración `demo/contramedidas` = `main` + `feat/reentry-prep` + `feat/eva-prebreathe`.

## Arranque

```bash
pnpm db:up                                   # MongoDB local (MONGODB_USE_LOCAL=true en apps/web/.env.local)
pnpm dev:web                                 # http://localhost:3000
pnpm --filter web seed:countermeasures       # crea DEMORE y DEMOEV
cd apps/mobile && pnpm ios                   # compila y abre el simulador (requiere licencia de Xcode aceptada)
```

## Web (Vista de Tierra)

Elige la misión en **Misiones** y abre:

| Misión | Página | Qué ver |
|---|---|---|
| `DEMORE` · Demo reentrada (día de reentrada) | **Reentrada** (`/reentry`, atajo `g a`) | Lucía lista; Omar a revisar (+34 lpm); Nina con mareo y poca hidratación (ayuda al levantarse); Tomás sin empezar |
| `DEMOEV` · Demo EVA lunar (en la Luna) | **Aptitud EVA** (`/eva`) | Kai apto; Sofía a revisar (prerrespiración de 8 de 15 min y O₂ de cabina bajo); Diego no apto (dolor articular tras la salida) |

## App (simulador)

1. Únete con el código `DEMORE` o `DEMOEV` y elige **Revisor (tu app)**. La dirección de Tierra por defecto es `http://localhost:3000`.
2. **DEMORE**: en **Rutina** aparece «Preparación de reentrada» → marca líquidos y prenda, y haz la prueba ortostática (los temporizadores son orientativos: puedes seguir antes de que terminen).
3. **DEMOEV**: en **Rutina** aparece «Salida extravehicular (EVA)» → elige el método, empieza la prerrespiración (15 min en la Luna), termina o interrumpe, y haz el chequeo al volver. Marcar «Dolor articular» abre el protocolo de enfermedad por descompresión.
4. Envía a Tierra desde la cola de envíos y recarga la página correspondiente de la web: tu fila se actualiza.
