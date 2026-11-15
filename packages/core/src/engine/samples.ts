import type { Reading, SampleConfig, SampleType } from '../contracts';
import { DAY_MS, ms } from './util';

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
  result: 'normal' | 'abnormal';
  detail?: string;
  enteredAt: string;
  author?: string;
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

const moduleOf = (r: Reading) =>
  /(?:^|;)module=([^;]+)/.exec(r.note ?? '')?.[1]?.trim() || undefined;

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
  options: { crewMember: string; takenAt: string; newId: () => string; module?: string },
): Reading {
  return {
    id: options.newId(),
    indicator: SAMPLE_INDICATOR,
    value: sample,
    unit: '',
    takenAt: options.takenAt,
    source: 'manual',
    simulated: false,
    crewMember: options.crewMember,
    ...(options.module ? { note: `module=${options.module}` } : {}),
  };
}

/** Collections that still wait for a lab result from Earth, oldest first. */
export function awaitingResults(readings: Reading[], results: Pick<SampleResult, 'id'>[]) {
  const done = new Set(results.map((r) => r.id));
  return collections(readings)
    .filter((r) => !done.has(r.id))
    .map((r) => ({
      id: r.id,
      sample: String(r.value),
      collectedAt: r.takenAt,
      crewMember: r.crewMember,
      ...(moduleOf(r) ? { module: moduleOf(r) } : {}),
    }));
}
