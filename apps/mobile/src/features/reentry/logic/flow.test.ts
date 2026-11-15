import type { Reading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import { nextPhase, parsePulse, recentWatchPulse } from './flow';

const NOW = new Date('2026-11-14T12:00:00.000Z');
const hr = (value: number, minutesAgo: number, source: Reading['source'] = 'watch'): Reading => ({
  id: `${value}-${minutesAgo}`,
  indicator: 'heart-rate',
  value,
  unit: 'bpm',
  takenAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
  source,
  simulated: false,
  crewMember: 'ana',
});

describe('parsePulse', () => {
  it('accepts whole and decimal pulses inside the valid range', () => {
    expect(parsePulse('72')).toBe(72);
    expect(parsePulse(' 64,6 ')).toBe(65);
    expect(parsePulse('220')).toBe(220);
  });

  it('rejects empty, out of range and malformed values', () => {
    expect(parsePulse('')).toBeUndefined();
    expect(parsePulse('29')).toBeUndefined();
    expect(parsePulse('221')).toBeUndefined();
    expect(parsePulse('7a')).toBeUndefined();
  });
});

describe('recentWatchPulse', () => {
  it('takes the latest watch pulse of the last 2 minutes', () => {
    expect(recentWatchPulse([hr(70, 1.5), hr(74, 0.5), hr(90, 0, 'manual')], NOW)).toBe(74);
  });

  it('ignores older and future readings', () => {
    expect(recentWatchPulse([hr(70, 3), hr(80, -1)], NOW)).toBeUndefined();
  });
});

describe('test flow', () => {
  it('walks intro → supine → standing → symptoms → result and stays at the end', () => {
    expect(nextPhase('intro')).toBe('supine');
    expect(nextPhase('supine')).toBe('standing');
    expect(nextPhase('standing')).toBe('symptoms');
    expect(nextPhase('symptoms')).toBe('result');
    expect(nextPhase('result')).toBe('result');
  });
});
