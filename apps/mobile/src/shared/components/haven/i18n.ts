import { defineTexts } from '@/shared/i18n';

export const havenTexts = defineTexts({
  es: {
    levelGreen: 'En rango',
    levelAmber: 'Revisar',
    levelRed: 'Emergencia',
    levelPending: 'Pendiente',
    phraseGreen: 'Sigue con tu rutina',
    phraseAmber: 'Repite la medición o avisa a Tierra',
    phraseRed: 'Abre el protocolo de emergencia ahora',
    phrasePending: 'No hay lectura vigente',
    level: 'Nivel',

    now: 'ahora',
    minAgo: 'hace {n} min',
    hoursAgo: 'hace {n} h',
    daysAgo: 'hace {n} d',
    noReading: 'sin lectura',
    simulated: '',
    whereFrom: '¿De dónde sale este dato?',
    sourceWatch: 'Apple Watch',
    sourceHealthkit: 'HealthKit',
    sourceHealthconnect: 'Health Connect',
    sourceBle: 'Bluetooth',
    sourceManual: 'Manual',
    sourceScreen: 'Pantalla',
    sourceRecord: 'Registro',
    sourceShip: 'Telemetría de la nave',
    sourcePhone: 'Sensor del teléfono',

    yourBaseline: 'Tu línea base',
    noCurrentValue: 'Sin lectura vigente',
    openDetails: 'Abrir detalle',

    zoneVitals: 'Signos vitales',
    zoneMind: 'Sueño y mente',
    zonePerformance: 'Rendimiento físico',
    zoneMetabolism: 'Metabolismo y nutrición',
    zoneEnvironment: 'Ambiente',
    bodyFigure: 'Figura humana con cinco grupos',

    actionsDone: 'acciones resueltas',
    ringSummary: '{n} de {total} acciones del día. Mide lo hecho, no la salud.',
    actions: 'acciones',
    dayComplete: 'día completo',
    dayIncomplete: 'día incompleto',
    today: 'hoy',

    chartEmpty: 'Sin lecturas en este periodo',
    chartLegend: 'Banda: tu rango habitual · Discontinua: tu línea base',
    baselineBand: 'Banda de tu línea base',
    latestReading: 'Última lectura',

    timer: 'Temporizador',
    timeLeft: 'Quedan {n}',
    paused: 'En pausa',
    timeUp: 'Tiempo cumplido',
    mood1: 'Muy mal',
    mood2: 'Mal',
    mood3: 'Regular',
    mood4: 'Bien',
    mood5: 'Muy bien',
    stress1: 'Muy bajo',
    stress2: 'Bajo',
    stress3: 'Medio',
    stress4: 'Alto',
    stress5: 'Muy alto',
    pickValue: 'Elige un valor del 1 al 5',

    day: 'Día {n}',
    phasePreparing: 'En preparación',
    phaseStartsOn: 'Empieza el {date}',
    phaseFinished: 'Finalizada',
    phaseFinishedDay: 'Finalizada · día {n}',
    delay: 'Retardo {n} min',
    linkUp: 'Con enlace',
    linkDown: 'Sin enlace · decisiones a bordo',
    queued: '{n} en cola',
    linkUpShort: 'Enlace',
    linkDownShort: 'Sin enlace',
    nothingQueued: 'Nada en cola',
    sos: 'SOS',
    openEmergency: 'Abrir emergencia',
    sosLabel: 'Emergencia, SOS',
    sosHint:
      'Mantén pulsado 3 segundos para enviar la alerta, o toca para abrir la pantalla de emergencia',
    sosHoldToast: 'Mantén 3 s para pedir ayuda',

    start: 'Empezar',
    measure: 'Medir',
    done: 'Hecho',
    skip: 'Omitir',
    skipped: 'Omitido',
    undo: 'Deshacer',

    deltaAbove: '{n} sobre tu línea base ({b})',
    deltaBelow: '{n} bajo tu línea base ({b})',
    deltaWithin: 'En tu rango habitual',

    zoneToReview: '{n} por revisar',
    zoneEmergency: '{n} en emergencia',
    zoneInRange: 'Todo en rango',
    zoneNoReadings: 'Sin lecturas vigentes',

    confirm: 'Confirmar',
    cancel: 'Cancelar',

    more: 'Más',
    less: 'Menos',
    seeAll: 'Ver todas ({n})',
    inRangeGroup: '{n} en rango',
    and: 'y',

    registerValue: 'Registrar valor',
    save: 'Guardar',
    willBe: 'Quedará',
    valueLabel: 'Valor',

    delayShort: '{n} min',
    queuedShort: '{n} en cola',

    holdToStart: 'Mantén pulsado para empezar',
    holdRelease: 'Suelta para cancelar',
    holdHint: 'Mantén pulsado 3 segundos',
    range1d: '1d',
    range7d: '7d',
    range4w: '4s',
    stepOf: 'Paso {n} de {total}',
    baselineShort: 'Base {b}',
    baseShort: 'Base {b}',
    personalRange: 'Tu rango',
    low: 'Mín.',
    high: 'Máx.',
    average: 'Media',
    history: 'Historial',
  },
  en: {
    levelGreen: 'In range',
    levelAmber: 'Check',
    levelRed: 'Emergency',
    levelPending: 'Pending',
    phraseGreen: 'Keep your routine',
    phraseAmber: 'Measure again or tell Earth',
    phraseRed: 'Open the emergency protocol now',
    phrasePending: 'No current reading',
    level: 'Level',

    now: 'now',
    minAgo: '{n} min ago',
    hoursAgo: '{n} h ago',
    daysAgo: '{n} d ago',
    noReading: 'no reading',
    simulated: '',
    whereFrom: 'Where does this data come from?',
    sourceWatch: 'Apple Watch',
    sourceHealthkit: 'HealthKit',
    sourceHealthconnect: 'Health Connect',
    sourceBle: 'Bluetooth',
    sourceManual: 'Manual',
    sourceScreen: 'Screen',
    sourceRecord: 'Record',
    sourceShip: 'Ship telemetry',
    sourcePhone: 'Phone sensor',

    yourBaseline: 'Your baseline',
    noCurrentValue: 'No current reading',
    openDetails: 'Open details',

    zoneVitals: 'Vital signs',
    zoneMind: 'Sleep and mind',
    zonePerformance: 'Physical performance',
    zoneMetabolism: 'Metabolism and nutrition',
    zoneEnvironment: 'Environment',
    bodyFigure: 'Human figure with five groups',

    actionsDone: 'actions done',
    ringSummary: '{n} of {total} daily actions. It measures what is done, not health.',
    actions: 'actions',
    dayComplete: 'complete day',
    dayIncomplete: 'incomplete day',
    today: 'today',

    chartEmpty: 'No readings in this period',
    chartLegend: 'Band: your usual range · Dashed: your baseline',
    baselineBand: 'Your baseline band',
    latestReading: 'Latest reading',

    timer: 'Timer',
    timeLeft: '{n} left',
    paused: 'Paused',
    timeUp: 'Time is up',
    mood1: 'Very bad',
    mood2: 'Bad',
    mood3: 'Okay',
    mood4: 'Good',
    mood5: 'Very good',
    stress1: 'Very low',
    stress2: 'Low',
    stress3: 'Medium',
    stress4: 'High',
    stress5: 'Very high',
    pickValue: 'Pick a value from 1 to 5',

    day: 'Day {n}',
    phasePreparing: 'Preparing',
    phaseStartsOn: 'Starts on {date}',
    phaseFinished: 'Finished',
    phaseFinishedDay: 'Finished · day {n}',
    delay: 'Delay {n} min',
    linkUp: 'Link up',
    linkDown: 'No link · decide on board',
    queued: '{n} queued',
    linkUpShort: 'Link',
    linkDownShort: 'No link',
    nothingQueued: 'Nothing queued',
    sos: 'SOS',
    openEmergency: 'Open emergency',
    sosLabel: 'Emergency, SOS',
    sosHint: 'Hold for 3 seconds to send the alert, or tap to open the emergency screen',
    sosHoldToast: 'Hold 3 s to ask for help',

    start: 'Start',
    measure: 'Measure',
    done: 'Done',
    skip: 'Skip',
    skipped: 'Skipped',
    undo: 'Undo',

    deltaAbove: '{n} above your baseline ({b})',
    deltaBelow: '{n} below your baseline ({b})',
    deltaWithin: 'Within your usual range',

    zoneToReview: '{n} to check',
    zoneEmergency: '{n} in emergency',
    zoneInRange: 'All in range',
    zoneNoReadings: 'No current readings',

    confirm: 'Confirm',
    cancel: 'Cancel',

    more: 'More',
    less: 'Less',
    seeAll: 'See all ({n})',
    inRangeGroup: '{n} in range',
    and: 'and',

    registerValue: 'Log a value',
    save: 'Save',
    willBe: 'Will be',
    valueLabel: 'Value',

    delayShort: '{n} min',
    queuedShort: '{n} queued',

    holdToStart: 'Hold to start',
    holdRelease: 'Release to cancel',
    holdHint: 'Hold for 3 seconds',
    range1d: '1d',
    range7d: '7d',
    range4w: '4w',
    stepOf: 'Step {n} of {total}',
    baselineShort: 'Baseline {b}',
    baseShort: 'Base {b}',
    personalRange: 'Your range',
    low: 'Low',
    high: 'High',
    average: 'Average',
    history: 'History',
  },
});

export type HavenTexts = (typeof havenTexts)['es'];

export function format(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export function ageText(t: HavenTexts, ageMin: number | undefined): string {
  if (ageMin === undefined || !Number.isFinite(ageMin)) return t.noReading;
  const min = Math.max(0, Math.round(ageMin));
  if (min < 1) return t.now;
  if (min < 60) return format(t.minAgo, { n: min });
  if (min < 60 * 48) return format(t.hoursAgo, { n: Math.round(min / 60) });
  return format(t.daysAgo, { n: Math.round(min / 1440) });
}

export function formatMetric(value: number, language = 'es'): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  const decimal = language.startsWith('es') ? ',' : '.';
  const [int, frac] = Math.abs(rounded).toFixed(digits).split('.');
  const grouped = abs >= 10_000 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') : int;
  const trimmed = frac ? frac.replace(/0+$/, '') : '';
  return `${rounded < 0 ? '−' : ''}${grouped}${trimmed ? decimal + trimmed : ''}`;
}
