import { describe, expect, it } from 'vitest';
import type { Assessment, Level } from '../contracts';
import { TEST_CONFIG } from './test-fixtures';
import { evaluateZones, overallLevel } from './zones';

const a = (indicator: string, level: Level): Assessment => ({
  indicator,
  level,
  explanation: { es: '', en: '' },
  actions: [],
  ageMin: 0,
  simulated: false,
});

describe('evaluateZones / overallLevel', () => {
  it('zone level is the worst; pending beats green', () => {
    const zones = evaluateZones(
      [a('heart-rate', 'green'), a('systolic-bp', 'pending'), a('glucose', 'amber')],
      TEST_CONFIG,
    );
    expect(zones.find((z) => z.zone === 'heart')?.level).toBe('pending');
    expect(zones.find((z) => z.zone === 'metabolism')?.level).toBe('amber');
    expect(zones.find((z) => z.zone === 'skin')?.level).toBe('pending');
    expect(zones.find((z) => z.zone === 'heart')?.assessments).toHaveLength(2);
  });

  it('order red > amber > pending > green', () => {
    expect(overallLevel([a('x', 'green'), a('y', 'pending')])).toBe('pending');
    expect(overallLevel([a('x', 'pending'), a('y', 'amber')])).toBe('amber');
    expect(overallLevel([a('x', 'red'), a('y', 'amber')])).toBe('red');
    expect(overallLevel([a('x', 'green')])).toBe('green');
    expect(overallLevel([])).toBe('pending');
  });
});
