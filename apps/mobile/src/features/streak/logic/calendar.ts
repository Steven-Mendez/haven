const DAY_MS = 86_400_000;

export const monthOf = (date: string | number): string =>
  (typeof date === 'number' ? new Date(date).toISOString() : date).slice(0, 7);

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function daysOfMonth(month: string): string[] {
  const start = Date.parse(`${month}-01T00:00:00.000Z`);
  const next = Date.parse(`${shiftMonth(month, 1)}-01T00:00:00.000Z`);
  return Array.from({ length: Math.round((next - start) / DAY_MS) }, (_, i) =>
    new Date(start + i * DAY_MS).toISOString().slice(0, 10),
  );
}

export function monthGrid(month: string, weekStart: 0 | 1): (string | null)[][] {
  const days = daysOfMonth(month);
  const first = new Date(`${days[0]}T00:00:00.000Z`).getUTCDay();
  const cells: (string | null)[] = [...Array((first - weekStart + 7) % 7).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export type DayStatus = 'complete' | 'protected' | 'missed' | 'open' | 'future' | 'none';

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

export function nextMilestone(
  streak: number,
  milestones: readonly number[],
): { value: number; left: number } | undefined {
  const value = milestones.find((m) => m > streak);
  return value === undefined ? undefined : { value, left: value - streak };
}
