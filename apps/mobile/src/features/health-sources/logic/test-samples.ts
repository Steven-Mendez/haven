// M07 · Development only (`__DEV__`): the records written into the iOS simulator's HealthKit by
// "Write test samples to HealthKit". They are data, not product logic: the app then reads them
// through the normal HealthKit provider. Deterministic (no randomness), so tests can check them.

export type QuantityPlan = {
  kind: 'quantity';
  /** HealthKit quantity type identifier. */
  type: string;
  unit: string;
  value: number;
  start: Date;
  end: Date;
};

export type SleepPlan = { kind: 'sleep'; start: Date; end: Date };

export type SamplePlan = QuantityPlan | SleepPlan;

/** Quantity types the tool writes (write permission is asked for these and sleep). */
export const TEST_QUANTITY_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierFlightsClimbed',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierOxygenSaturation',
] as const;
export const TEST_SLEEP_TYPE = 'HKCategoryTypeIdentifierSleepAnalysis' as const;

const HOUR = 3_600_000;
const MIN = 60_000;

/** Small deterministic wobble in [-1, 1] per day and series. */
function wobble(day: number, series: number): number {
  return Math.sin(day * 1.7 + series * 2.3);
}

const at = (dayStart: Date, hours: number) => new Date(dayStart.getTime() + hours * HOUR);

/**
 * `days` days of records ending today (today only up to `now`):
 * - steps: four walks of ~1,400 steps (08, 12, 16, 19 h); distance 0.72 m per step; floors 2–4;
 * - heart rate: resting samples at 07, 13 and 21 h (60–70 bpm);
 * - HRV (SDNN) at 07 h (45–55 ms); SpO₂ at 07 and 21 h (96–98 %, written as a fraction);
 * - sleep: one night 23:00 → 06:30 (7–7.5 h asleep) ending that morning;
 * - plus one recent record of each quantity 10 min before `now`, so the latest value of each
 *   indicator comes from HealthKit whatever the time of day.
 */
export function planTestSamples(now: Date, days = 7): SamplePlan[] {
  const out: SamplePlan[] = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let d = days - 1; d >= 0; d--) {
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - d);
    const n = Math.round(dayStart.getTime() / (24 * HOUR));
    const push = (type: string, unit: string, value: number, startH: number, minutes = 1) => {
      const start = at(dayStart, startH);
      const end = new Date(start.getTime() + minutes * MIN);
      if (end <= now) out.push({ kind: 'quantity', type, unit, value, start, end });
    };
    // Sleep that ends this morning (started the evening before).
    const sleepStart = at(dayStart, -1);
    const sleepEnd = new Date(sleepStart.getTime() + (7.5 + 0.25 * wobble(n, 5)) * HOUR);
    if (sleepEnd <= now) out.push({ kind: 'sleep', start: sleepStart, end: sleepEnd });

    for (const [i, hour] of [8, 12, 16, 19].entries()) {
      const steps = Math.round(1400 + 250 * wobble(n, i));
      push('HKQuantityTypeIdentifierStepCount', 'count', steps, hour, 20);
      push(
        'HKQuantityTypeIdentifierDistanceWalkingRunning',
        'km',
        Math.round(steps * 0.72) / 1000,
        hour,
        20,
      );
    }
    push('HKQuantityTypeIdentifierFlightsClimbed', 'count', 3 + Math.round(wobble(n, 6)), 12, 5);
    for (const [i, hour] of [7, 13, 21].entries()) {
      push(
        'HKQuantityTypeIdentifierHeartRate',
        'count/min',
        Math.round(65 + 5 * wobble(n, 10 + i)),
        hour,
      );
    }
    push(
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
      'ms',
      Math.round(50 + 5 * wobble(n, 7)),
      7,
    );
    for (const [i, hour] of [7, 21].entries()) {
      push('HKQuantityTypeIdentifierOxygenSaturation', '%', 0.97 + 0.01 * wobble(n, 20 + i), hour);
    }
  }
  const end = new Date(now.getTime() - 10 * MIN);
  const start = new Date(end.getTime() - MIN);
  const recent = (type: string, unit: string, value: number) =>
    out.push({ kind: 'quantity', type, unit, value, start, end });
  recent('HKQuantityTypeIdentifierStepCount', 'count', 320);
  recent('HKQuantityTypeIdentifierDistanceWalkingRunning', 'km', 0.23);
  recent('HKQuantityTypeIdentifierFlightsClimbed', 'count', 1);
  recent('HKQuantityTypeIdentifierHeartRate', 'count/min', 66);
  recent('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms', 52);
  recent('HKQuantityTypeIdentifierOxygenSaturation', '%', 0.97);
  return out;
}
