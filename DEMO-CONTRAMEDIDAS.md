# Demo: contramedidas

Rama de integración `demo/contramedidas` = `main` + `feat/reentry-prep` + `feat/eva-prebreathe` + `feat/medication-log` + `feat/sample-collection` + `feat/exercise-plan` + `feat/motion-sickness`.

## Arranque

```bash
pnpm db:up                                   # MongoDB local (MONGODB_USE_LOCAL=true en apps/web/.env.local)
pnpm dev:web                                 # http://localhost:3000
pnpm --filter web seed:countermeasures       # crea DEMORE, DEMOEV, DEMOMS (con ejercicio) y DEMOCN (borra lo que hubiera en ellas)
cd apps/mobile && pnpm ios                   # compila y abre el simulador (requiere licencia de Xcode aceptada)
```

## Web (Vista de Tierra)

Elige la misión en **Misiones** y abre:

| Misión | Página | Qué ver |
|---|---|---|
| `DEMORE` · Demo reentrada (día de reentrada) | **Reentrada** (`/reentry`, atajo `g a`) | Lucía lista; Omar a revisar (+34 lpm); Nina con mareo y poca hidratación (ayuda al levantarse); Tomás sin empezar |
| `DEMOEV` · Demo EVA lunar (en la Luna) | **Aptitud EVA** (`/eva`) | Kai apto; Sofía a revisar (prerrespiración de 8 de 15 min y O₂ de cabina bajo); Diego no apto (dolor articular tras la salida) |
| `DEMOMS` · Demo medicación y muestras (día 40 en la estación) | **Medicación** (`/medication`, atajo `g p`) | Inés con adherencia buena; Jonas baja (36 %) y antibiótico en curso; Aiko con 2 de 2 antimareos hoy. el lápiz de cada fila abre el plan en un panel lateral |
| `DEMOMS` | **Muestras** (`/samples`, atajo `g s`) | Estado de cada muestra por tripulante; en «Resultados por cargar», la ficha de la saliva de Jonas muestra su nota, fiebre la noche anterior y un historial de herpes en aumento; al escribir los valores se clasifica sola |
| `DEMOMS` | **Ejercicio** (`/exercise`, atajo `g x`) | Cumplimiento de la pauta de fuerza + aeróbico en los últimos 7 días. Inés cumple y su autoevaluación sugiere subir; Jonas, baja (3 días) y sugiere bajar carga; Aiko tiene una pauta suave ajustada por el mareo y la autoevaluación pendiente. El lápiz abre la pauta en un panel lateral; «Volver a la pauta inicial» quita el ajuste |
| `DEMOCN` · Demo cinetosis (día 2 en la Luna) | **Cinetosis** (`/motion`, atajo `g v`) | Escala de mareo 0–10 de las últimas 48 h, los últimos 7 días, la ventana de adaptación tras el cambio de gravedad y la prueba de equilibrio. Lucía ya casi sin mareo; Omar con náusea (7/10) y equilibrio muy alterado; Mei con mareo ayer y sin registro hoy |

## App (simulador)

1. Únete con el código `DEMORE` o `DEMOEV` y elige **Revisor (tu app)**. La dirección de Tierra por defecto es `http://localhost:3000`.
2. **DEMORE**: en **Rutina** aparece «Preparación de reentrada» → marca líquidos y prenda, y haz la prueba ortostática (los temporizadores son orientativos: puedes seguir antes de que terminen).
3. **DEMOEV**: en **Rutina** aparece «Salida extravehicular (EVA)» → elige el método, empieza la prerrespiración (15 min en la Luna), termina o interrumpe, y haz el chequeo al volver. Marcar «Dolor articular» abre el protocolo de enfermedad por descompresión.
4. **DEMOMS**: en **Rutina** aparecen «Medicación» (vitamina D y antibiótico ya tocan) y «Muestras» (atrasadas). Marca «Tomé»/«Omití» y registra recogidas; el hisopado pide el módulo. Si cambias tu plan en la web, la app lo descarga en menos de un minuto.
5. **Ejercicio** (DEMOMS): Rutina avisa de los minutos de hoy o de la autoevaluación semanal. En **Ejercicio** registra sesiones de fuerza o aeróbico (equipo y minutos), mira la semana y la pauta que fijó Tierra; si la cambias en la web, llega en la próxima sincronización.
6. **DEMOCN** (únete con ese código): en **Rutina** aparece «Cinetosis» porque es el día 2 tras llegar a la Luna. En **Cinetosis** anota la escala, sigue los movimientos de cabeza guiados y haz la prueba de equilibrio (el simulador no tiene acelerómetro: la prueba avisa de que no hay datos; en un iPhone real funciona).
7. Los datos viajan a Tierra en el siguiente paquete (aprox. cada minuto): recarga la página de la web y tu fila se actualiza. Tus recogidas aparecen en «Resultados por cargar» para que cargues el resultado.

Para unir la app del simulador sin QR:

```bash
xcrun simctl openurl booted "haven://join?mission=DEMOMS&crew=revisor&api=http%3A%2F%2Flocalhost%3A3000"
```

## Identidad visual

Las pestañas de Tierra de estas funcionalidades (Aptitud EVA, Reentrada, Medicación y Muestras) siguen el rediseño de `main`: tabla en tarjeta con cabecera en mayúsculas pequeñas, icono en cuadro en la primera columna, estados como píldoras sobre los colores de escala y pie con totales. Las piezas comunes están en `apps/web/src/features/extras/components/panel-parts.tsx`.
