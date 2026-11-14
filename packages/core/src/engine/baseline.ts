import type { Assessment, Reading } from '../contracts';
import { ms, numeric, percentile, round, series } from './util';

export type Baseline = NonNullable<Assessment['baseline']>;

export type BaselineOptions = {
  /** Use the last N numeric readings (default 30). */
  n?: number;
  /** Minimum readings needed to return a baseline (default 5). */
  minimum?: number;
  /** Only readings taken strictly before this instant (e.g. to exclude the reading being evaluated). */
  before?: Date;
  /** Leave out readings flagged as an acute episode (`note` starting with `emergency`). Default true. */
  excludeAcute?: boolean;
  /** Keep at most one reading per this many minutes, so a burst cannot dominate (default 30; 0 = off). */
  minSpacingMin?: number;
  /** Drop values whose modified z-score (MAD) exceeds this (default 3.5; Infinity = off). */
  outlierZ?: number;
};

/** `note` of readings taken during an acute episode (emergency monitor of the watch). */
export const ACUTE_EPISODE_NOTE = 'emergency-monitor';
export const BASELINE_MIN_SPACING_MIN = 30;
export const BASELINE_OUTLIER_Z = 3.5;

export const BASELINE_N = 30;
export const BASELINE_MINIMUM = 5;

/**
 * Personal baseline of an indicator: **median** and **p10–p90** range of its last N numeric readings
 * (N = 30 by default; with fewer than 5 readings there is no baseline and it returns undefined).
 *
 * p10–p90 was chosen over the interquartile range because with short or integer series
 * (memory 3–5, mood 1–5) the IQR collapses to 0 easily. `baselineDeviation: k` rules compare
 * |value − median| with k × (p90 − p10); see `baselineWidth`.
 *
 * Acute episodes are kept out of the baseline in three steps, applied in this order:
 * 1. **Flagged readings:** `note` starting with `emergency` (the watch `monitor` stream arrives with
 *    `note: 'emergency-monitor'`, see `readingsFromEnvelope`).
 * 2. **Burst thinning:** oldest first, a reading is kept only if it is ≥ 30 min after the last kept
 *    one, so a dense 10-minute episode counts at most once instead of filling the last N. If fewer
 *    than `minimum` readings would remain (only dense data exists), thinning is skipped.
 * 3. **MAD outliers:** values with modified z-score |0.6745 × (v − median) / MAD| > 3.5
 *    (Iglewicz & Hoaglin) are dropped. If MAD is 0 (most values identical, e.g. integer scales) the
 *    step is skipped, so rare but normal values (a 5 in mood, one PVT lapse) are not discarded.
 * Slow drifts survive: a drift spreads the series evenly, which widens the MAD, so its points stay
 * well below the cut-off. Only isolated jumps far from the bulk are dropped.
 */
export function computeBaseline(
  readings: Reading[],
  indicator: string,
  options?: BaselineOptions,
): Assessment['baseline'] | undefined {
  const n = options?.n ?? BASELINE_N;
  const minimum = options?.minimum ?? BASELINE_MINIMUM;
  const limit = options?.before?.getTime();
  const excludeAcute = options?.excludeAcute ?? true;
  const spacingMs = (options?.minSpacingMin ?? BASELINE_MIN_SPACING_MIN) * 60_000;
  const candidates = series(readings, indicator).filter(
    (r) =>
      (limit === undefined || ms(r.takenAt) < limit) &&
      numeric(r) !== undefined &&
      !(excludeAcute && r.note?.startsWith('emergency')),
  );
  const spaced: number[] = [];
  let lastKept = Number.NEGATIVE_INFINITY;
  for (const r of candidates) {
    const t = ms(r.takenAt);
    if (spacingMs > 0 && t - lastKept < spacingMs) continue;
    lastKept = t;
    spaced.push(numeric(r) as number);
  }
  // Thinning must not starve the baseline: with too few spaced readings, use all of them.
  const pool = spaced.length >= minimum ? spaced : candidates.map((r) => numeric(r) as number);
  const values = withoutOutliers(pool, options?.outlierZ ?? BASELINE_OUTLIER_Z).slice(-n);
  if (values.length < Math.max(1, minimum)) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: round(percentile(sorted, 0.5), 3),
    range: [round(percentile(sorted, 0.1), 3), round(percentile(sorted, 0.9), 3)],
  };
}

/** Drops values with modified z-score > z (MAD-based); no-op when MAD is 0 or z is not finite. */
function withoutOutliers(values: number[], z: number): number[] {
  if (!Number.isFinite(z) || values.length < 3) return values;
  const median = percentile(
    [...values].sort((a, b) => a - b),
    0.5,
  );
  const mad = percentile(
    values.map((v) => Math.abs(v - median)).sort((a, b) => a - b),
    0.5,
  );
  if (mad === 0) return values;
  return values.filter((v) => Math.abs((0.6745 * (v - median)) / mad) <= z);
}

/** Baselines for several indicators at once (shortcut for mobile and Earth). */
export function computeBaselines(
  readings: Reading[],
  indicators: string[],
  options?: BaselineOptions,
): Record<string, Baseline> {
  const result: Record<string, Baseline> = {};
  for (const id of indicators) {
    const b = computeBaseline(readings, id, options);
    if (b) result[id] = b;
  }
  return result;
}

/**
 * Width of the personal range used by `baselineDeviation`. Floored at 5 % of |median| (or 1e-6) so a
 * series without variation does not fire the rule on any tiny change.
 */
export function baselineWidth(b: Baseline): number {
  return Math.max(b.range[1] - b.range[0], Math.abs(b.median) * 0.05, 1e-6);
}

/** Deviation of a value from the baseline, in multiples of the personal range (signed). */
export function deviation(value: number, b: Baseline): number {
  return (value - b.median) / baselineWidth(b);
}
