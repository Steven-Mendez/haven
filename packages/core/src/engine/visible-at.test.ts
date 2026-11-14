import { describe, expect, it } from 'vitest';
import { computeVisibleAt } from './visible-at';

describe('computeVisibleAt', () => {
  it('adds the delay in minutes', () => {
    expect(computeVisibleAt('2026-11-14T09:00:00.000Z', 22)).toBe('2026-11-14T09:22:00.000Z');
  });
  it('ignores the deprecated demo factor (no artificial speed-up)', () => {
    expect(computeVisibleAt('2026-11-14T09:00:00.000Z', 11, 60)).toBe('2026-11-14T09:11:00.000Z');
  });
});
