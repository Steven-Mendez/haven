import {
  type Adherence,
  type AsNeeded,
  adherence,
  asNeededToday,
  type CrewPlan,
  type Dose,
  dosesForDay,
  type Level,
  medications,
  type Reading,
} from '@haven/core';

export type MedicationRow = {
  id: string;
  name: string;
  lastDataAt: string | null;
  noRecentData: boolean;
  plan: CrewPlan;
  adherence: Adherence;
  today: Dose[];
  asNeeded: AsNeeded[];
  level: Level;
};

/** Green from 90 % adherence, amber from 70 %, red below; pending with nothing to measure. */
export function adherenceLevel(a: Adherence): Level {
  if (a.percent === null) return 'pending';
  if (a.percent >= 90) return 'green';
  if (a.percent >= 70) return 'amber';
  return 'red';
}

export function medicationRow(
  member: { id: string; name: string; lastDataAt: string | null; noRecentData: boolean },
  plan: CrewPlan,
  readings: Reading[],
  now: Date,
): MedicationRow {
  const a = adherence(plan, medications, readings, now);
  return {
    ...member,
    plan,
    adherence: a,
    today: dosesForDay(plan, medications, readings, now),
    asNeeded: asNeededToday(plan, medications, readings, now),
    level: adherenceLevel(a),
  };
}

export function weekdayName(weekday: number, lang: 'es' | 'en'): string {
  // 2026-11-15 is a Sunday.
  return new Date(Date.UTC(2026, 10, 15 + weekday)).toLocaleDateString(lang, {
    weekday: 'long',
    timeZone: 'UTC',
  });
}
