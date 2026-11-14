import { loadConfig } from '@haven/core';
import { describe, expect, it } from 'vitest';

import { pointLevel } from './point-level';

const config = loadConfig();
const indicator = (id: string) => {
  const found = config.indicators.find((i) => i.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

describe('pointLevel (thresholds from core config)', () => {
  it('heart rate: 160 red, 110 amber, 70 none', () => {
    const hr = indicator('heart-rate');
    expect(pointLevel(hr, 160)).toBe('red');
    expect(pointLevel(hr, 110)).toBe('amber');
    expect(pointLevel(hr, 70)).toBeUndefined();
  });

  it('ignores red rules that need symptoms (HR 130 is amber, not red)', () => {
    expect(pointLevel(indicator('heart-rate'), 130)).toBe('amber');
  });

  it('systolic: 190 red (crisis range), 150 amber', () => {
    const bp = indicator('systolic-bp');
    expect(pointLevel(bp, 190)).toBe('red');
    expect(pointLevel(bp, 150)).toBe('amber');
  });
});
