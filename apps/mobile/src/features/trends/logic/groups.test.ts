import type { Level } from '@haven/core';
import { describe, expect, it } from 'vitest';
import { groupByZone, levelCounts } from './groups';

const items = [
  { id: 'hr', zone: 'heart' },
  { id: 'hrv', zone: 'heart' },
  { id: 'spo2', zone: 'lungs' },
  { id: 'co2', zone: 'lungs' },
  { id: 'acuity', zone: 'head' },
];
const levels: Record<string, Level> = {
  hr: 'green',
  hrv: 'amber',
  spo2: 'green',
  co2: 'pending',
  acuity: 'green',
};
const levelOf = (id: string) => levels[id] ?? 'pending';

describe('trend groups', () => {
  it('counts indicators per level', () => {
    expect(levelCounts(Object.values(levels))).toEqual({ red: 0, amber: 1, green: 3, pending: 1 });
    expect(levelCounts([])).toEqual({ red: 0, amber: 0, green: 0, pending: 0 });
  });

  it('puts the worst zone first and the worst row first inside it', () => {
    const groups = groupByZone(items, levelOf, ['head', 'lungs', 'heart']);
    expect(groups.map((g) => g.zone)).toEqual(['heart', 'lungs', 'head']);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['hrv', 'hr']);
    expect(groups[1]?.items.map((i) => i.id)).toEqual(['co2', 'spo2']);
  });

  it('breaks ties between zones with the config order', () => {
    const allGreen = () => 'green' as Level;
    expect(groupByZone(items, allGreen, ['head', 'lungs', 'heart']).map((g) => g.zone)).toEqual([
      'head',
      'lungs',
      'heart',
    ]);
  });
});
