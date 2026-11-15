import {
  type awaitingResults,
  type Level,
  type Reading,
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

export type PendingSample = ReturnType<typeof awaitingResults>[number] & { name: string };

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
