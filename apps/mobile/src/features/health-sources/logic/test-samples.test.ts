import { describe, expect, it } from 'vitest';
import { planTestSamples, TEST_QUANTITY_TYPES } from './test-samples';

const NOW = new Date(2026, 10, 1, 14, 0);

describe('planTestSamples', () => {
  const plan = planTestSamples(NOW, 7);
  const quantities = plan.filter((p) => p.kind === 'quantity');

  it('covers every type and sleep, never in the future', () => {
    for (const type of TEST_QUANTITY_TYPES) {
      expect(quantities.some((p) => p.type === type)).toBe(true);
    }
    expect(plan.filter((p) => p.kind === 'sleep')).toHaveLength(7);
    expect(plan.every((p) => p.end <= NOW && p.start < p.end)).toBe(true);
  });

  it('daily steps are plausible and today stops at now', () => {
    const steps = (day: number) =>
      quantities
        .filter((p) => p.type === 'HKQuantityTypeIdentifierStepCount' && p.start.getDate() === day)
        .reduce((s, p) => s + p.value, 0);
    expect(steps(31)).toBeGreaterThan(4000);
    expect(steps(31)).toBeLessThan(7500);
    // Today at 14:00 only the 08 and 12 h walks exist, plus the recent record ending 13:50.
    const today = quantities.filter(
      (p) => p.type === 'HKQuantityTypeIdentifierStepCount' && p.start.getDate() === 1,
    );
    expect(today.map((p) => p.end.getHours())).toEqual([8, 12, 13]);
  });

  it('values are in physiological ranges and deterministic', () => {
    const of = (type: string) => quantities.filter((p) => p.type === type).map((p) => p.value);
    expect(Math.min(...of('HKQuantityTypeIdentifierHeartRate'))).toBeGreaterThanOrEqual(60);
    expect(Math.max(...of('HKQuantityTypeIdentifierHeartRate'))).toBeLessThanOrEqual(70);
    expect(Math.max(...of('HKQuantityTypeIdentifierOxygenSaturation'))).toBeLessThanOrEqual(0.98);
    expect(planTestSamples(NOW, 7)).toEqual(plan);
  });
});
