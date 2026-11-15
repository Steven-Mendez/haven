import type { EvaConfig, Level, PrebreatheMethod, Reading } from '../contracts';
import { HOUR_MS, MIN_MS, ms, numeric } from './util';

/** Reading saved when a prebreathe ends; its value is the minutes breathed. */
export const PREBREATHE_INDICATOR = 'eva-prebreathe';
/** Reading saved after the EVA; its value is 'clear' or 'symptoms'. */
export const EVA_CHECK_INDICATOR = 'eva-check';

const SYMPTOM_INDICATOR = 'symptom';

export type PrebreatheResult = {
  method: string;
  minutes: number;
  required: number;
  complete: boolean;
  startedAt?: string;
  takenAt: string;
};

export type EvaCheck = { clear: boolean; symptoms: string[]; takenAt: string };

export type EvaPrepReadiness = 'cleared' | 'prebreathing-done' | 'incomplete' | 'symptoms' | 'none';

export type EvaPrepStatus = {
  prebreathe?: PrebreatheResult;
  check?: EvaCheck;
  readiness: EvaPrepReadiness;
  level: Level;
};

export function prebreatheMethods(environment: string, cfg: EvaConfig): PrebreatheMethod[] {
  return cfg.methods.filter((m) => m.environments.includes(environment));
}

export function canPerformEva(environment: string, cfg: EvaConfig): boolean {
  return prebreatheMethods(environment, cfg).length > 0;
}

export function prebreatheMinutes(startedAt: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - ms(startedAt)) / MIN_MS));
}

type ReadingOptions = { crewMember: string; takenAt: string; newId: () => string };

const notes = (fields: Record<string, string | number>) =>
  Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(';');

const parseNote = (note: string | undefined): Record<string, string> =>
  Object.fromEntries(
    (note ?? '')
      .split(';')
      .filter(Boolean)
      .map((part) => {
        const [key = '', ...rest] = part.split('=');
        return [key.trim(), rest.join('=').trim()];
      }),
  );

export function prebreatheReading(
  session: { method: PrebreatheMethod; startedAt: string },
  options: ReadingOptions,
): Reading {
  const minutes = prebreatheMinutes(session.startedAt, new Date(options.takenAt));
  return {
    id: options.newId(),
    indicator: PREBREATHE_INDICATOR,
    value: minutes,
    unit: 'min',
    takenAt: options.takenAt,
    source: 'screen',
    simulated: false,
    crewMember: options.crewMember,
    note: notes({
      method: session.method.id,
      required: session.method.minutes,
      started: session.startedAt,
    }),
  };
}

/** The post-EVA check plus one symptom reading per symptom felt. */
export function postEvaReadings(symptoms: string[], options: ReadingOptions): Reading[] {
  const base = { simulated: false, crewMember: options.crewMember, takenAt: options.takenAt };
  return [
    {
      ...base,
      id: options.newId(),
      indicator: EVA_CHECK_INDICATOR,
      value: symptoms.length ? 'symptoms' : 'clear',
      unit: '',
      source: 'screen',
      note: notes({ symptoms: symptoms.join(',') }),
    },
    ...symptoms.map((s) => ({
      ...base,
      id: options.newId(),
      indicator: SYMPTOM_INDICATOR,
      value: s,
      unit: '',
      source: 'manual' as const,
    })),
  ];
}

export function parsePrebreathe(reading: Reading, cfg: EvaConfig): PrebreatheResult | undefined {
  if (reading.indicator !== PREBREATHE_INDICATOR) return undefined;
  const minutes = numeric(reading);
  if (minutes === undefined) return undefined;
  const fields = parseNote(reading.note);
  const method = fields.method ?? '';
  const fromNote = Number(fields.required);
  const required =
    Number.isFinite(fromNote) && fromNote > 0
      ? fromNote
      : (cfg.methods.find((m) => m.id === method)?.minutes ?? 0);
  return {
    method,
    minutes,
    required,
    complete: minutes >= required,
    ...(fields.started ? { startedAt: fields.started } : {}),
    takenAt: reading.takenAt,
  };
}

export function parseEvaCheck(reading: Reading): EvaCheck | undefined {
  if (reading.indicator !== EVA_CHECK_INDICATOR) return undefined;
  const symptoms = (parseNote(reading.note).symptoms ?? '').split(',').filter(Boolean);
  return {
    clear: reading.value === 'clear' && symptoms.length === 0,
    symptoms,
    takenAt: reading.takenAt,
  };
}

export function evaPrepStatus(readings: Reading[], cfg: EvaConfig, now: Date): EvaPrepStatus {
  const end = now.getTime();
  const start = end - cfg.windowHours * HOUR_MS;
  const recent = readings
    .filter((r) => ms(r.takenAt) <= end && ms(r.takenAt) >= start)
    .sort((a, b) => ms(a.takenAt) - ms(b.takenAt));
  const lastOf = (indicator: string) => recent.filter((r) => r.indicator === indicator).at(-1);
  const pre = lastOf(PREBREATHE_INDICATOR);
  const chk = lastOf(EVA_CHECK_INDICATOR);
  const prebreathe = pre ? parsePrebreathe(pre, cfg) : undefined;
  const check = chk ? parseEvaCheck(chk) : undefined;
  // A check older than the latest prebreathe belongs to an earlier EVA.
  const currentCheck =
    check && (!prebreathe || ms(check.takenAt) >= ms(prebreathe.takenAt)) ? check : undefined;

  let readiness: EvaPrepReadiness;
  if (currentCheck && !currentCheck.clear) readiness = 'symptoms';
  else if (currentCheck) readiness = 'cleared';
  else if (prebreathe && !prebreathe.complete) readiness = 'incomplete';
  else if (prebreathe) readiness = 'prebreathing-done';
  else readiness = 'none';

  const level = (
    {
      symptoms: 'red',
      incomplete: 'amber',
      'prebreathing-done': 'green',
      cleared: 'green',
      none: 'pending',
    } as const
  )[readiness];

  return {
    ...(prebreathe ? { prebreathe } : {}),
    ...(currentCheck ? { check: currentCheck } : {}),
    readiness,
    level,
  };
}
