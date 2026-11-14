// Activity-style rings from real data (SPEC.md v3.1 «Anillos»). Pure: imports only @haven/core.
//   routine      = today's daily actions done / zones (7)
//   measurements = scheduled indicators (everyHours ≤ 24) with a reading that day / scheduled
//   wellbeing    = check-in (mood + stress) + cognitive battery (reaction time) that day / 2
// Rings show progress, never health.

import { type Config, dailyProgress, type Reading } from '@haven/core';

export type RingValue = { done: number; total: number };
export type DayRings = {
  /** UTC date «YYYY-MM-DD». */
  date: string;
  routine: RingValue;
  measurements: RingValue;
  wellbeing: RingValue;
};

const DAY_MS = 86_400_000;

/** Indicators that belong to the wellbeing ring, not to «measurements». */
const WELLBEING_IDS = new Set([
  'mood',
  'stress',
  'sleep',
  'reaction-time',
  'pvt-lapses',
  'working-memory',
  'go-nogo-accuracy',
]);

export const dateKey = (iso: string | number | Date): string =>
  new Date(iso).toISOString().slice(0, 10);

/** Indicators expected at least once a day for the measurements ring. */
export function scheduledIndicators(config: Config): string[] {
  return config.indicators
    .filter((i) => (i.everyHours ?? 0) > 0 && (i.everyHours ?? 0) <= 24 && !WELLBEING_IDS.has(i.id))
    .map((i) => i.id);
}

/** The three rings of one UTC day (`now` cuts «today» at the current time). */
export function ringsForDay(
  readings: Reading[],
  config: Config,
  date: string,
  now: Date,
): DayRings {
  const end = date === dateKey(now) ? now : new Date(`${date}T23:59:59.999Z`);
  const ofDay = readings.filter(
    (r) => dateKey(r.takenAt) === date && Date.parse(r.takenAt) <= end.getTime(),
  );
  const has = (id: string) => ofDay.some((r) => r.indicator === id);
  const progress = dailyProgress(readings, config, end);
  const scheduled = scheduledIndicators(config);
  return {
    date,
    routine: { done: progress.filter((p) => p.progress >= 1).length, total: config.zones.length },
    measurements: { done: scheduled.filter(has).length, total: scheduled.length },
    wellbeing: {
      done: (has('mood') && has('stress') ? 1 : 0) + (has('reaction-time') ? 1 : 0),
      total: 2,
    },
  };
}

/** The last `count` days (oldest first), today included. */
export function ringHistory(readings: Reading[], config: Config, now: Date, count = 7): DayRings[] {
  const today = Date.parse(`${dateKey(now)}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, i) =>
    ringsForDay(readings, config, dateKey(today - (count - 1 - i) * DAY_MS), now),
  );
}

export const fraction = (v: RingValue) => (v.total > 0 ? v.done / v.total : 0);
