// Series aggregation for M04 Trends. Pure: only `@haven/core` and relative modules.

import type { Reading } from '@haven/core';

export type TrendRange = 'day' | 'week' | 'mission';

export const TREND_RANGES: readonly TrendRange[] = ['day', 'week', 'mission'];

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Bucket width per range: raw-ish points for a day, hourly for a week, 6 h for the mission. */
export const BUCKET_MS: Record<TrendRange, number> = {
  day: 15 * 60_000,
  week: 2 * HOUR_MS,
  mission: 6 * HOUR_MS,
};

/** Default mission window when no readings exist yet. */
export const DEFAULT_MISSION_DAYS = 30;

/**
 * Time window `[from, to]` (epoch ms) of a range. `mission` starts at `missionStartMs` (or the first
 * reading if later than it would be, or 30 days back without data).
 */
export function rangeWindow(
  range: TrendRange,
  nowMs: number,
  missionStartMs?: number,
): [number, number] {
  if (range === 'day') return [nowMs - DAY_MS, nowMs];
  if (range === 'week') return [nowMs - 7 * DAY_MS, nowMs];
  const start = missionStartMs ?? nowMs - DEFAULT_MISSION_DAYS * DAY_MS;
  return [Math.min(start, nowMs - DAY_MS), nowMs];
}

export type AggregatedSeries = {
  /** `[epoch ms, mean]` per bucket, sorted (bucket centre, last bucket at the latest reading). */
  data: [number, number][];
  /** Latest numeric reading inside the window. */
  last?: Reading;
  /** Number of readings in the window. */
  count: number;
};

const numeric = (r: Reading): number | undefined =>
  typeof r.value === 'number' && Number.isFinite(r.value) ? r.value : undefined;

/**
 * Averages numeric readings into fixed buckets of the range so 30 days at a 5-minute cadence draw
 * as ≤ ~120 points. The bucket that contains the latest reading is pinned to that reading's time
 * (and value), so the highlighted last point is the real latest reading.
 */
export function aggregateSeries(
  readings: Reading[],
  range: TrendRange,
  window: [number, number],
  bucketMs: number = BUCKET_MS[range],
): AggregatedSeries {
  const [from, to] = window;
  const buckets = new Map<number, { sum: number; n: number }>();
  let last: Reading | undefined;
  let lastMs = -Infinity;
  let count = 0;
  for (const r of readings) {
    const value = numeric(r);
    if (value === undefined) continue;
    const t = Date.parse(r.takenAt);
    if (!Number.isFinite(t) || t < from || t > to) continue;
    count++;
    const key = Math.floor((t - from) / bucketMs);
    const bucket = buckets.get(key) ?? { sum: 0, n: 0 };
    bucket.sum += value;
    bucket.n++;
    buckets.set(key, bucket);
    if (t >= lastMs) {
      lastMs = t;
      last = r;
    }
  }
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  const lastKey = last ? Math.floor((lastMs - from) / bucketMs) : undefined;
  const data: [number, number][] = keys.map((key) => {
    const { sum, n } = buckets.get(key) as { sum: number; n: number };
    if (key === lastKey && last) return [lastMs, numeric(last) as number];
    const centre = Math.min(to, from + key * bucketMs + bucketMs / 2);
    return [centre, Math.round((sum / n) * 100) / 100];
  });
  return {
    data,
    last,
    count,
  };
}

/** Earliest `takenAt` (epoch ms) among readings, or `undefined`. */
export function firstReadingMs(readings: Reading[]): number | undefined {
  let first: number | undefined;
  for (const r of readings) {
    const t = Date.parse(r.takenAt);
    if (Number.isFinite(t) && (first === undefined || t < first)) first = t;
  }
  return first;
}
