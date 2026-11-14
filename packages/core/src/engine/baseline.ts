import type { Assessment, Reading } from '../contracts';
import { ms, numeric, percentile, round, series } from './util';

export type Baseline = NonNullable<Assessment['baseline']>;

export type BaselineOptions = {
  n?: number;
  minimum?: number;
  before?: Date;
  excludeAcute?: boolean;
  minSpacingMin?: number;
  outlierZ?: number;
};

export const ACUTE_EPISODE_NOTE = 'emergency-monitor';
export const BASELINE_MIN_SPACING_MIN = 30;
export const BASELINE_OUTLIER_Z = 3.5;

export const BASELINE_N = 30;
export const BASELINE_MINIMUM = 5;

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
  const pool = spaced.length >= minimum ? spaced : candidates.map((r) => numeric(r) as number);
  const values = withoutOutliers(pool, options?.outlierZ ?? BASELINE_OUTLIER_Z).slice(-n);
  if (values.length < Math.max(1, minimum)) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: round(percentile(sorted, 0.5), 3),
    range: [round(percentile(sorted, 0.1), 3), round(percentile(sorted, 0.9), 3)],
  };
}

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

export function baselineWidth(b: Baseline): number {
  return Math.max(b.range[1] - b.range[0], Math.abs(b.median) * 0.05, 1e-6);
}

export function deviation(value: number, b: Baseline): number {
  return (value - b.median) / baselineWidth(b);
}
