// Streak («racha») of HAVEN. Pure: no React, no @/shared.
// A day counts when the routine ring is closed (the minimum routine: every daily action done).
// Protected days (an emergency happened, or the mission was without a link) never break the
// streak: they are skipped. Today never breaks it while it is still open. The goal is health,
// not pressure: no comparisons between crew members.

export type StreakDay = { date: string; complete: boolean };

const DAY_MS = 86_400_000;
const prev = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) - DAY_MS).toISOString().slice(0, 10);

/** Current streak ending today (or yesterday if today is still open). */
export function currentStreak(
  days: StreakDay[],
  today: string,
  protectedDays: Iterable<string> = [],
): number {
  const complete = new Set(days.filter((d) => d.complete).map((d) => d.date));
  const safe = new Set(protectedDays);
  // biome-ignore lint/complexity/useMathMinMax: ISO date strings, not numbers
  const oldest = days.reduce((min, d) => (d.date < min ? d.date : min), today);
  let n = complete.has(today) ? 1 : 0;
  let d = prev(today);
  while (d >= oldest) {
    if (complete.has(d)) n++;
    else if (!safe.has(d)) break;
    d = prev(d);
  }
  return n;
}

/** Longest streak in the history (same rules; protected days bridge, never add). */
export function bestStreak(days: StreakDay[], protectedDays: Iterable<string> = []): number {
  const safe = new Set(protectedDays);
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  let run = 0;
  for (const day of sorted) {
    if (day.complete) {
      run++;
      best = Math.max(best, run);
    } else if (!safe.has(day.date)) run = 0;
  }
  return best;
}

/** Streak milestones (days) and mission-day milestones, celebrated once each. */
export const STREAK_MILESTONES = [7, 14, 30, 60, 100] as const;
export const MISSION_MILESTONES = [100, 200, 365, 500] as const;

/** The milestone reached now that was not celebrated yet (`seen` = stored keys). */
export function pendingMilestone(
  streak: number,
  missionDay: number,
  seen: Iterable<string>,
): { kind: 'streak' | 'mission'; value: number; key: string } | undefined {
  const done = new Set(seen);
  const s = [...STREAK_MILESTONES].reverse().find((m) => streak >= m && !done.has(`streak-${m}`));
  if (s !== undefined && streak === s) return { kind: 'streak', value: s, key: `streak-${s}` };
  const m = MISSION_MILESTONES.find((v) => missionDay === v && !done.has(`mission-${v}`));
  if (m !== undefined) return { kind: 'mission', value: m, key: `mission-${m}` };
  return undefined;
}
