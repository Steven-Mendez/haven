import type { Level, Reading, ReadingSource, ReentryConfig } from '../contracts';
import { HOUR_MS, ms, numeric } from './util';

export const REENTRY_ENVIRONMENT = 'reentry';
/** Reading that marks a checklist item as done; its value is the item id. */
export const REENTRY_CHECK_INDICATOR = 'reentry-check';
/** Reading with the heart-rate rise on standing, in bpm. */
export const ORTHOSTATIC_INDICATOR = 'orthostatic-test';
export const ORTHOSTATIC_ITEM = 'orthostatic-test';

const SYMPTOM_INDICATOR = 'symptom';

export type OrthostaticResult = {
  supine: number;
  standing: number;
  rise: number;
  symptoms: string[];
  level: Level;
};

export type ReentryReadiness = 'ready' | 'in-progress' | 'review' | 'unfit' | 'not-started';

export type ReentryStatus = {
  items: { id: string; doneAt?: string }[];
  done: number;
  total: number;
  orthostatic?: OrthostaticResult & { takenAt: string };
  readiness: ReentryReadiness;
  level: Level;
};

export function isReentry(environment: string | undefined): boolean {
  return environment === REENTRY_ENVIRONMENT;
}

export function orthostaticLevel(rise: number, symptoms: string[], cfg: ReentryConfig): Level {
  const o = cfg.orthostatic;
  if (rise >= o.redRise || symptoms.some((s) => o.symptoms.includes(s))) return 'red';
  if (rise >= o.amberRise) return 'amber';
  return 'green';
}

export function orthostaticResult(
  supine: number,
  standing: number,
  symptoms: string[],
  cfg: ReentryConfig,
): OrthostaticResult {
  const rise = Math.round(standing - supine);
  return { supine, standing, rise, symptoms, level: orthostaticLevel(rise, symptoms, cfg) };
}

function encodeNote(r: Pick<OrthostaticResult, 'supine' | 'standing' | 'symptoms'>): string {
  return `supine=${r.supine};standing=${r.standing};symptoms=${r.symptoms.join(',')}`;
}

export function parseOrthostatic(
  reading: Reading,
  cfg: ReentryConfig,
): (OrthostaticResult & { takenAt: string }) | undefined {
  if (reading.indicator !== ORTHOSTATIC_INDICATOR) return undefined;
  const rise = numeric(reading);
  if (rise === undefined) return undefined;
  const fields = Object.fromEntries(
    (reading.note ?? '').split(';').map((part) => {
      const [key = '', value = ''] = part.split('=');
      return [key.trim(), value.trim()];
    }),
  );
  const supine = Number(fields.supine);
  const standing = Number(fields.standing);
  const symptoms = (fields.symptoms ?? '').split(',').filter(Boolean);
  return {
    supine: Number.isFinite(supine) ? supine : Number.NaN,
    standing: Number.isFinite(standing) ? standing : Number.NaN,
    rise,
    symptoms,
    level: orthostaticLevel(rise, symptoms, cfg),
    takenAt: reading.takenAt,
  };
}

type ReadingOptions = { crewMember: string; takenAt: string; newId: () => string };

export function reentryCheckReading(item: string, options: ReadingOptions): Reading {
  return {
    id: options.newId(),
    indicator: REENTRY_CHECK_INDICATOR,
    value: item,
    unit: '',
    takenAt: options.takenAt,
    source: 'manual',
    simulated: false,
    crewMember: options.crewMember,
  };
}

/**
 * Readings saved at the end of the orthostatic test: both pulses as heart-rate
 * readings, the rise, any symptoms felt while standing and the checklist mark.
 */
export function orthostaticReadings(
  result: Pick<OrthostaticResult, 'supine' | 'standing' | 'symptoms'>,
  options: ReadingOptions & { supineAt: string; source?: ReadingSource },
): Reading[] {
  const base = { simulated: false, crewMember: options.crewMember };
  const source = options.source ?? 'manual';
  return [
    {
      ...base,
      id: options.newId(),
      indicator: 'heart-rate',
      value: result.supine,
      unit: 'bpm',
      takenAt: options.supineAt,
      source,
      note: 'supine',
    },
    {
      ...base,
      id: options.newId(),
      indicator: 'heart-rate',
      value: result.standing,
      unit: 'bpm',
      takenAt: options.takenAt,
      source,
      note: 'standing',
    },
    {
      ...base,
      id: options.newId(),
      indicator: ORTHOSTATIC_INDICATOR,
      value: Math.round(result.standing - result.supine),
      unit: 'bpm',
      takenAt: options.takenAt,
      source: 'screen',
      note: encodeNote(result),
    },
    ...result.symptoms.map((s) => ({
      ...base,
      id: options.newId(),
      indicator: SYMPTOM_INDICATOR,
      value: s,
      unit: '',
      takenAt: options.takenAt,
      source: 'manual' as const,
    })),
    reentryCheckReading(ORTHOSTATIC_ITEM, options),
  ];
}

export function reentryStatus(readings: Reading[], cfg: ReentryConfig, now: Date): ReentryStatus {
  const end = now.getTime();
  const start = end - cfg.windowHours * HOUR_MS;
  const recent = readings
    .filter((r) => {
      const t = ms(r.takenAt);
      return t <= end && t >= start;
    })
    .sort((a, b) => ms(a.takenAt) - ms(b.takenAt));

  const doneAt = new Map<string, string>();
  for (const r of recent) {
    if (r.indicator === REENTRY_CHECK_INDICATOR) doneAt.set(String(r.value), r.takenAt);
  }
  const last = recent.filter((r) => r.indicator === ORTHOSTATIC_INDICATOR).at(-1);
  const orthostatic = last ? parseOrthostatic(last, cfg) : undefined;
  if (orthostatic)
    doneAt.set(ORTHOSTATIC_ITEM, doneAt.get(ORTHOSTATIC_ITEM) ?? last?.takenAt ?? '');

  const items = cfg.checklist.map((item) => {
    const at = doneAt.get(item.id);
    return at ? { id: item.id, doneAt: at } : { id: item.id };
  });
  const done = items.filter((i) => i.doneAt).length;
  const total = items.length;

  let readiness: ReentryReadiness;
  if (orthostatic?.level === 'red') readiness = 'unfit';
  else if (orthostatic?.level === 'amber') readiness = 'review';
  else if (done === 0) readiness = 'not-started';
  else if (done < total) readiness = 'in-progress';
  else readiness = 'ready';

  const level: Level = {
    ready: 'green',
    'in-progress': 'pending',
    'not-started': 'pending',
    review: 'amber',
    unfit: 'red',
  }[readiness] as Level;

  return { items, done, total, ...(orthostatic ? { orthostatic } : {}), readiness, level };
}
