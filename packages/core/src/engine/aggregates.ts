import type { Reading } from '../contracts';
import { dayKey, mean, numeric, round } from './util';

export const MIN_CREW_FOR_AGGREGATE = 3;

export function crewAggregates(
  readingsByCrewMember: Record<string, Reading[]>,
  indicator: string,
  options?: { minimum?: number },
): { date: string; mean: number }[] | null {
  const minimum = options?.minimum ?? MIN_CREW_FOR_AGGREGATE;
  const byDate = new Map<string, number[]>();
  let withData = 0;
  for (const readings of Object.values(readingsByCrewMember)) {
    const days = new Map<string, number[]>();
    for (const r of readings) {
      if (r.indicator !== indicator) continue;
      const v = numeric(r);
      if (v === undefined) continue;
      const d = dayKey(r.takenAt);
      days.set(d, [...(days.get(d) ?? []), v]);
    }
    if (days.size > 0) withData++;
    for (const [d, vs] of days) byDate.set(d, [...(byDate.get(d) ?? []), mean(vs)]);
  }
  if (withData < minimum) return null;
  return [...byDate.entries()]
    .filter(([, means]) => means.length >= minimum)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, means]) => ({ date, mean: round(mean(means), 3) }));
}
