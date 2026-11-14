// Streak calendar (Duolingo / Speak month view). Pure: no React, no @/shared.
// Dates are UTC keys «YYYY-MM-DD» and months «YYYY-MM», like the rings and the streak.

const DAY_MS = 86_400_000;

/** Month key «YYYY-MM» of a date key or a timestamp. */
export const monthOf = (date: string | number): string =>
  (typeof date === 'number' ? new Date(date).toISOString() : date).slice(0, 7);

/** The month `delta` months away from `month`. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Every date of `month`, in order. */
export function daysOfMonth(month: string): string[] {
  const start = Date.parse(`${month}-01T00:00:00.000Z`);
  const next = Date.parse(`${shiftMonth(month, 1)}-01T00:00:00.000Z`);
  return Array.from({ length: Math.round((next - start) / DAY_MS) }, (_, i) =>
    new Date(start + i * DAY_MS).toISOString().slice(0, 10),
  );
}

/**
 * Weeks of `month` as rows of 7 cells (`null` = padding outside the month).
 * `weekStart`: 0 = Sunday (English), 1 = Monday (Spanish).
 */
export function monthGrid(month: string, weekStart: 0 | 1): (string | null)[][] {
  const days = daysOfMonth(month);
  const first = new Date(`${days[0]}T00:00:00.000Z`).getUTCDay();
  const cells: (string | null)[] = [...Array((first - weekStart + 7) % 7).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export type DayStatus = 'complete' | 'protected' | 'missed' | 'open' | 'future' | 'none';

/**
 * How a calendar day reads: complete (routine ring closed), protected (emergency or no link: never
 * breaks the streak), missed, open (today, not complete yet), future, or none (before any data).
 */
export function dayStatus(
  date: string,
  today: string,
  complete: boolean,
  protectedDays: ReadonlySet<string>,
  firstDay: string | undefined,
): DayStatus {
  if (date > today) return 'future';
  if (complete) return 'complete';
  if (protectedDays.has(date)) return 'protected';
  if (date === today) return 'open';
  if (!firstDay || date < firstDay) return 'none';
  return 'missed';
}

/** The next streak milestone above `streak` and the days left to reach it. */
export function nextMilestone(
  streak: number,
  milestones: readonly number[],
): { value: number; left: number } | undefined {
  const value = milestones.find((m) => m > streak);
  return value === undefined ? undefined : { value, left: value - streak };
}
