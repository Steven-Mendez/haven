import {
  type Assessment,
  type Level,
  type MissionPhase,
  REENTRY_ENVIRONMENT,
  type Reading,
  type ReentryStatus,
  reentry,
  reentryStatus,
  worstLevel,
} from '@haven/core';

export type ReentryRow = {
  id: string;
  name: string;
  lastDataAt: string | null;
  noRecentData: boolean;
  status: ReentryStatus;
  hydration: Level;
  bloodPressure: Level;
};

export function reentryRow(
  member: { id: string; name: string; lastDataAt: string | null; noRecentData: boolean },
  readings: Reading[],
  assessments: Assessment[],
  now: Date,
): ReentryRow {
  const level = (ids: string[]) =>
    worstLevel(assessments.filter((a) => ids.includes(a.indicator)).map((a) => a.level));
  return {
    ...member,
    status: reentryStatus(readings, reentry, now),
    hydration: level(['hydration']),
    bloodPressure: level(['systolic-bp', 'diastolic-bp']),
  };
}

/** Days from the mission day to the first day of reentry; 0 or less once it started. */
export function daysToReentry(phases: MissionPhase[] | undefined, day: number): number | null {
  if (!phases?.length) return null;
  let start = 1;
  let reentryStart: number | null = null;
  for (const phase of phases) {
    if (phase.environment === REENTRY_ENVIRONMENT) reentryStart = start;
    start += phase.days;
  }
  return reentryStart === null ? null : reentryStart - day;
}
