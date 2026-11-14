import type { Level, Reading } from '../contracts';

export const MIN_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export const LEVEL_ORDER: Record<Level, number> = { green: 0, pending: 1, amber: 2, red: 3 };

export function worstLevel(levels: Level[]): Level {
  if (levels.length === 0) return 'pending';
  return levels.reduce((a, b) => (LEVEL_ORDER[b] > LEVEL_ORDER[a] ? b : a));
}

export function ms(iso: string): number {
  return new Date(iso).getTime();
}

export function numeric(r: Reading): number | undefined {
  if (typeof r.value === 'number') return Number.isFinite(r.value) ? r.value : undefined;
  if (r.value.trim() === '') return undefined;
  const v = Number(r.value);
  return Number.isFinite(v) ? v : undefined;
}

export function series(readings: Reading[], indicator: string, now?: Date): Reading[] {
  const limit = now ? now.getTime() : Number.POSITIVE_INFINITY;
  return readings
    .filter((r) => r.indicator === indicator && ms(r.takenAt) <= limit)
    .sort((a, b) => ms(a.takenAt) - ms(b.takenAt));
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const a = sorted[lo] as number;
  const b = sorted[Math.min(lo + 1, sorted.length - 1)] as number;
  return a + (b - a) * (pos - lo);
}

export function dayKey(instant: Date | string, offsetMin = 0): string {
  const t = (typeof instant === 'string' ? ms(instant) : instant.getTime()) + offsetMin * MIN_MS;
  return new Date(t).toISOString().slice(0, 10);
}

export function previousDay(date: string): string {
  return new Date(ms(`${date}T00:00:00.000Z`) - DAY_MS).toISOString().slice(0, 10);
}

export function round(v: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
