import { describe, expect, it } from 'vitest';
import { isInvalidVital, manualVitalReadings, parseVital } from './vitals';

const now = new Date('2026-11-01T10:00:00Z');

describe('manual vitals', () => {
  it('parses plausible values and rejects typos', () => {
    expect(parseVital('spo2', ' 94,5 ')).toBe(94.5);
    expect(parseVital('spo2', '')).toBeUndefined();
    expect(parseVital('spo2', '940')).toBeUndefined();
    expect(parseVital('systolic-bp', 'abc')).toBeUndefined();
    expect(isInvalidVital('heart-rate', '600')).toBe(true);
    expect(isInvalidVital('heart-rate', '')).toBe(false);
  });

  it('builds manual readings with config units, skipping empty or invalid fields', () => {
    let n = 0;
    const readings = manualVitalReadings(
      { 'systolic-bp': '88', 'diastolic-bp': '54', spo2: '91', 'heart-rate': '9999' },
      { 'systolic-bp': 'mmHg', 'diastolic-bp': 'mmHg', spo2: '%' },
      'elena-vega',
      now,
      () => `r${++n}`,
    );
    expect(readings.map((r) => [r.indicator, r.value, r.unit])).toEqual([
      ['systolic-bp', 88, 'mmHg'],
      ['diastolic-bp', 54, 'mmHg'],
      ['spo2', 91, '%'],
    ]);
    expect(readings[0]).toMatchObject({
      id: 'r1',
      source: 'manual',
      simulated: false,
      crewMember: 'elena-vega',
      takenAt: now.toISOString(),
    });
  });
});
