import { CATEGORY_CODES, type Indicator, type Reading } from '@haven/core';

export type ChartRange = 'day' | 'week' | 'month';
export const CHART_RANGES: readonly ChartRange[] = ['day', 'week', 'month'];

const DAY_MS = 86_400_000;
const RANGE_MS: Record<ChartRange, number> = { day: DAY_MS, week: 7 * DAY_MS, month: 30 * DAY_MS };

export function rangeDomain(range: ChartRange, now: number): [number, number] {
  return [now - RANGE_MS[range], now];
}

export function categoriesOf(indicator: Indicator): readonly string[] {
  const known = CATEGORY_CODES[indicator.id];
  if (known) return known;
  const fromRules = indicator.rules.flatMap((r) => r.categories ?? []);
  return [...new Set(fromRules)];
}

export function chartValue(indicator: Indicator, value: Reading['value']): number | undefined {
  if (indicator.kind === 'category') {
    const index = categoriesOf(indicator).indexOf(String(value));
    return index >= 0 ? index : undefined;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function chartPoints(
  indicator: Indicator,
  readings: Reading[],
  [from, to]: [number, number],
): [number, number][] {
  const points: [number, number][] = [];
  for (const r of readings) {
    const t = new Date(r.takenAt).getTime();
    if (!(t >= from && t <= to)) continue;
    const v = chartValue(indicator, r.value);
    if (v !== undefined) points.push([t, v]);
  }
  return points;
}
