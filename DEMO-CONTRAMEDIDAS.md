# Demo: contramedidas

Rama de integración `demo/contramedidas` = `main` + `feat/reentry-prep` + `feat/eva-prebreathe` + `feat/medication-log` + `feat/sample-collection`.

## Arranque

```bash
pnpm db:up                                   # MongoDB local (MONGODB_USE_LOCAL=true en apps/web/.env.local)
pnpm dev:web                                 # http://localhost:3000
pnpm --filter web seed:countermeasures       # crea DEMORE, DEMOEV y DEMOMS (borra lo que hubiera en ellas)
cd apps/mobile && pnpm ios                   # compila y abre el simulador (requiere licencia de Xcode aceptada)
```

## Web (Vista de Tierra)

Elige la misión en **Misiones** y abre:

| Misión | Página | Qué ver |
|---|---|---|
| `DEMORE` · Demo reentrada (día de reentrada) | **Reentrada** (`/reentry`, atajo `g a`) | Lucía lista; Omar a revisar (+34 lpm); Nina con mareo y poca hidratación (ayuda al levantarse); Tomás sin empezar |
| `DEMOEV` · Demo EVA lunar (en la Luna) | **Aptitud EVA** (`/eva`) | Kai apto; Sofía a revisar (prerrespiración de 8 de 15 min y O₂ de cabina bajo); Diego no apto (dolor articular tras la salida) |
| `DEMOMS` · Demo medicación y muestras (día 40 en la estación) | **Medicación** (`/medication`, atajo `g p`) | Inés con adherencia buena; Jonas baja (36 %) y antibiótico en curso; Aiko con 2 de 2 antimareos hoy. «Editar plan» asigna medicación a cualquiera |
| `DEMOMS` | **Muestras** (`/samples`, atajo `g s`) | Estado de cada muestra por tripulante; saliva de Jonas alterada (reactivación viral); 3 recogidas esperando resultado con su formulario |

## App (simulador)

1. Únete con el código `DEMORE` o `DEMOEV` y elige **Revisor (tu app)**. La dirección de Tierra por defecto es `http://localhost:3000`.
2. **DEMORE**: en **Rutina** aparece «Preparación de reentrada» → marca líquidos y prenda, y haz la prueba ortostática (los temporizadores son orientativos: puedes seguir antes de que terminen).
3. **DEMOEV**: en **Rutina** aparece «Salida extravehicular (EVA)» → elige el método, empieza la prerrespiración (15 min en la Luna), termina o interrumpe, y haz el chequeo al volver. Marcar «Dolor articular» abre el protocolo de enfermedad por descompresión.
4. **DEMOMS**: en **Rutina** aparecen «Medicación» (vitamina D y antibiótico ya tocan) y «Muestras» (atrasadas). Marca «Tomé»/«Omití» y registra recogidas; el hisopado pide el módulo. Si cambias tu plan en la web, la app lo descarga en menos de un minuto.
5. Los datos viajan a Tierra en el siguiente paquete (aprox. cada minuto): recarga la página de la web y tu fila se actualiza. Tus recogidas aparecen en «Resultados por cargar» para que cargues el resultado.

Para unir la app del simulador sin QR:

```bash
xcrun simctl openurl booted "haven://join?mission=DEMOMS&crew=revisor&api=http%3A%2F%2Flocalhost%3A3000"
```
