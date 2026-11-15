import {
  type Collection,
  type ContextReading,
  type Level,
  type Reading,
  type SampleLevel,
  type SampleResult,
  type SampleState,
  type SampleStatus,
  sampleConfig,
  sampleStates,
} from '@haven/core';

export type SampleRow = {
  id: string;
  name: string;
  lastDataAt: string | null;
  noRecentData: boolean;
  states: SampleState[];
  /** Latest result of each sample type, by sample id. */
  results: Record<string, SampleResult | undefined>;
};

/** A collection waiting for its lab result, with what Earth needs to judge it. */
export type PendingSample = Collection & {
  name: string;
  /** Mission day the sample was collected on. */
  day: number;
  age: { days: number; stale: boolean };
  context: { readings: ContextReading[]; symptoms: string[] };
  history: SampleResult[];
};

export const RESULT_LEVEL: Record<SampleLevel, Level> = {
  normal: 'green',
  abnormal: 'amber',
  critical: 'red',
};

export function missionDayOf(start: string, at: string): number {
  return Math.max(1, Math.floor((Date.parse(at) - Date.parse(start)) / 86_400_000) + 1);
}

export const STATUS_LEVEL: Record<SampleStatus, Level> = {
  collected: 'green',
  due: 'amber',
  overdue: 'red',
  upcoming: 'pending',
};

export function sampleRow(
  member: { id: string; name: string; lastDataAt: string | null; noRecentData: boolean },
  missionDay: number,
  readings: Reading[],
  results: SampleResult[],
  now: Date,
): SampleRow {
  const own = results.filter((r) => r.crewMember === member.id);
  return {
    ...member,
    states: sampleStates(sampleConfig, missionDay, readings, now),
    results: Object.fromEntries(
      sampleConfig.samples.map((s) => [s.id, own.filter((r) => r.sample === s.id).at(-1)]),
    ),
  };
}
