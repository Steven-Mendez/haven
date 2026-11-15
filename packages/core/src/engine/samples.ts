import type { Reading, SampleConfig, SampleType } from '../contracts';
import { DAY_MS, HOUR_MS, ms, numeric } from './util';

/** Reading saved when a sample is collected; its value is the sample type id. */
export const SAMPLE_INDICATOR = 'sample-collected';

export type SampleStatus = 'collected' | 'due' | 'overdue' | 'upcoming';

export type SampleState = {
  sample: string;
  status: SampleStatus;
  /** Mission day of the current collection, if one is already due. */
  dueDay?: number;
  nextDay: number;
  last?: { id: string; takenAt: string; module?: string };
};

export type SampleResult = {
  /** Id of the collection reading the result belongs to. */
  id: string;
  mission: string;
  crewMember: string;
  sample: string;
  collectedAt: string;
  module?: string;
  /** Final level: the computed one, or Earth's when it overrode it. */
  result: SampleLevel;
  /** Lab values by analyte id. */
  values?: Record<string, number>;
  /** Level computed from the values, kept when Earth overrides it. */
  computed?: SampleLevel;
  overridden?: boolean;
  detail?: string;
  enteredAt: string;
  author?: string;
};

export type SampleLevel = 'normal' | 'abnormal' | 'critical';

export type Collection = {
  id: string;
  sample: string;
  collectedAt: string;
  crewMember: string;
  module?: string;
  /** Answers to the collection questions, by question id. */
  answers: Record<string, string>;
  comment?: string;
};

/** The latest collection day at or before `missionDay`, and the next one after it. */
export function collectionDays(
  sample: Pick<SampleType, 'firstDay' | 'everyDays'>,
  missionDay: number,
): { current?: number; next: number } {
  if (missionDay < sample.firstDay) return { next: sample.firstDay };
  const k = Math.floor((missionDay - sample.firstDay) / sample.everyDays);
  const current = sample.firstDay + k * sample.everyDays;
  return { current, next: current + sample.everyDays };
}

/** Reads what the app saved with a collection: module, answers and comment. */
export function parseCollection(r: Reading): Collection {
  const answers: Record<string, string> = {};
  let module: string | undefined;
  let comment: string | undefined;
  for (const part of (r.note ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!value) continue;
    if (key === 'module') module = value;
    else if (key === 'comment') comment = safeDecode(value);
    else if (key.startsWith('q.')) answers[key.slice(2)] = value;
  }
  return {
    id: r.id,
    sample: String(r.value),
    collectedAt: r.takenAt,
    crewMember: r.crewMember,
    ...(module ? { module } : {}),
    answers,
    ...(comment ? { comment } : {}),
  };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const moduleOf = (r: Reading) => parseCollection(r).module;

export function collections(readings: Reading[], sample?: string): Reading[] {
  return readings
    .filter((r) => r.indicator === SAMPLE_INDICATOR && (!sample || r.value === sample))
    .sort((a, b) => ms(a.takenAt) - ms(b.takenAt));
}

/**
 * Status of one sample type on a mission day. `now` is used to find when the
 * current collection day started: mission days start at 00:00 mission time (UTC).
 */
export function sampleState(
  sample: SampleType,
  cfg: SampleConfig,
  missionDay: number,
  readings: Reading[],
  now: Date,
): SampleState {
  const { current, next } = collectionDays(sample, missionDay);
  const lastReading = collections(readings, sample.id)
    .filter((r) => ms(r.takenAt) <= now.getTime())
    .at(-1);
  const last = lastReading
    ? {
        id: lastReading.id,
        takenAt: lastReading.takenAt,
        ...(moduleOf(lastReading) ? { module: moduleOf(lastReading) } : {}),
      }
    : undefined;
  const base = { sample: sample.id, nextDay: next, ...(last ? { last } : {}) };
  if (current === undefined) return { ...base, status: 'upcoming' };
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dueSince = today - (missionDay - current) * DAY_MS;
  if (last && ms(last.takenAt) >= dueSince)
    return { ...base, status: 'collected', dueDay: current };
  const late = missionDay - current >= cfg.overdueAfterDays;
  return { ...base, status: late ? 'overdue' : 'due', dueDay: current };
}

export function sampleStates(
  cfg: SampleConfig,
  missionDay: number,
  readings: Reading[],
  now: Date,
): SampleState[] {
  return cfg.samples.map((s) => sampleState(s, cfg, missionDay, readings, now));
}

export function sampleReading(
  sample: string,
  options: {
    crewMember: string;
    takenAt: string;
    newId: () => string;
    module?: string;
    answers?: Record<string, string>;
    comment?: string;
  },
): Reading {
  const clean = (v: string) => v.replace(/[;=]/g, ' ').trim();
  const parts = [
    ...(options.module ? [`module=${clean(options.module)}`] : []),
    ...Object.entries(options.answers ?? {}).map(([k, v]) => `q.${clean(k)}=${clean(v)}`),
    ...(options.comment?.trim()
      ? [`comment=${encodeURIComponent(options.comment.trim().slice(0, 200))}`]
      : []),
  ];
  return {
    id: options.newId(),
    indicator: SAMPLE_INDICATOR,
    value: sample,
    unit: '',
    takenAt: options.takenAt,
    source: 'manual',
    simulated: false,
    crewMember: options.crewMember,
    ...(parts.length ? { note: parts.join(';') } : {}),
  };
}

/** Collections that still wait for a lab result from Earth, oldest first. */
export function awaitingResults(
  readings: Reading[],
  results: Pick<SampleResult, 'id'>[],
): Collection[] {
  const done = new Set(results.map((r) => r.id));
  return collections(readings)
    .filter((r) => !done.has(r.id))
    .map(parseCollection);
}

export type AnalyteFlag = { analyte: string; value: number; level: SampleLevel };

/**
 * Level of a set of lab values: critical when any is outside its red range,
 * abnormal when any is outside its reference range, normal otherwise.
 * Undefined when no value was entered.
 */
export function classifySample(
  sample: Pick<SampleType, 'analytes'>,
  values: Record<string, number | undefined>,
): { level?: SampleLevel; flags: AnalyteFlag[] } {
  const flags: AnalyteFlag[] = [];
  for (const a of sample.analytes) {
    const value = values[a.id];
    if (value === undefined || !Number.isFinite(value)) continue;
    const outside = (r: [number, number]) => value < r[0] || value > r[1];
    flags.push({
      analyte: a.id,
      value,
      level: outside(a.red) ? 'critical' : outside(a.green) ? 'abnormal' : 'normal',
    });
  }
  if (flags.length === 0) return { flags };
  const rank: Record<SampleLevel, number> = { normal: 0, abnormal: 1, critical: 2 };
  const level = flags.reduce<SampleLevel>(
    (worst, f) => (rank[f.level] > rank[worst] ? f.level : worst),
    'normal',
  );
  return { level, flags };
}

export type ContextReading = {
  indicator: string;
  value: number | string;
  unit: string;
  takenAt: string;
};

/**
 * What surrounded a collection: the latest reading of each context indicator
 * and the symptoms from `hoursBefore` hours before until one hour after it.
 */
export function sampleContext(
  sample: Pick<SampleType, 'context'>,
  readings: Reading[],
  collectedAt: string,
  hoursBefore = 24,
): { readings: ContextReading[]; symptoms: string[] } {
  const at = ms(collectedAt);
  const inWindow = (r: Reading) => {
    const t = ms(r.takenAt);
    return t >= at - hoursBefore * HOUR_MS && t <= at + HOUR_MS;
  };
  const near = readings.filter(inWindow).sort((a, b) => ms(a.takenAt) - ms(b.takenAt));
  const latest = sample.context.flatMap((id) => {
    const r = near.filter((x) => x.indicator === id).at(-1);
    if (!r) return [];
    const value = typeof r.value === 'number' ? r.value : (numeric(r) ?? r.value);
    return [{ indicator: id, value, unit: r.unit, takenAt: r.takenAt }];
  });
  const symptoms = [
    ...new Set(
      near
        .filter((r) => r.indicator === 'symptom')
        .map((r) => String(r.value))
        .filter((v) => v && !['none', 'no', 'ninguno'].includes(v)),
    ),
  ];
  return { readings: latest, symptoms };
}

/** Earlier results of the same sample type for a crew member, newest first. */
export function sampleHistory(
  results: SampleResult[],
  crewMember: string,
  sample: string,
  before?: string,
): SampleResult[] {
  return results
    .filter(
      (r) =>
        r.crewMember === crewMember &&
        r.sample === sample &&
        (!before || ms(r.collectedAt) < ms(before)),
    )
    .sort((a, b) => ms(b.collectedAt) - ms(a.collectedAt));
}

/** Whole days between collection and `now`, and whether that exceeds the sample's limit. */
export function sampleAge(
  sample: Pick<SampleType, 'maxAgeDays'>,
  collectedAt: string,
  now: Date,
): { days: number; stale: boolean } {
  const days = Math.max(0, Math.floor((now.getTime() - ms(collectedAt)) / DAY_MS));
  return { days, stale: days > sample.maxAgeDays };
}
