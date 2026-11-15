import { describe, expect, it } from 'vitest';
import { sampleConfig as cfg } from '../config';
import {
  awaitingResults,
  collectionDays,
  SAMPLE_INDICATOR,
  sampleReading,
  sampleState,
  sampleStates,
} from './samples';

const NOW = new Date('2026-11-14T12:00:00.000Z');
let n = 0;
const newId = () => `s${++n}`;
const at = (daysAgo: number, hours = 0) =>
  new Date(NOW.getTime() - daysAgo * 86_400_000 - hours * 3_600_000).toISOString();
const saliva = cfg.samples.find((s) => s.id === 'saliva');
if (!saliva) throw new Error('saliva');

describe('sample config', () => {
  it('has bilingual samples with unique ids and positive days', () => {
    const ids = cfg.samples.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of cfg.samples) {
      for (const t of [s.name, s.detail, s.abnormal]) expect(t.es && t.en, s.id).toBeTruthy();
      expect(s.everyDays, s.id).toBeGreaterThan(0);
      expect(s.firstDay, s.id).toBeGreaterThan(0);
      for (const m of s.modules ?? []) expect(m.name.es && m.name.en, m.id).toBeTruthy();
    }
    expect(cfg.overdueAfterDays).toBeGreaterThan(0);
  });
});

describe('collectionDays', () => {
  it('finds the current and next collection days', () => {
    const s = { firstDay: 3, everyDays: 7 };
    expect(collectionDays(s, 1)).toEqual({ next: 3 });
    expect(collectionDays(s, 3)).toEqual({ current: 3, next: 10 });
    expect(collectionDays(s, 12)).toEqual({ current: 10, next: 17 });
  });
});

describe('sampleState', () => {
  it('is upcoming before the first day and due on a collection day', () => {
    expect(sampleState(saliva, cfg, 2, [], NOW)).toMatchObject({ status: 'upcoming', nextDay: 3 });
    expect(sampleState(saliva, cfg, 10, [], NOW)).toMatchObject({ status: 'due', dueDay: 10 });
  });

  it('turns overdue after the grace days and collected once taken since the due day', () => {
    expect(sampleState(saliva, cfg, 12, [], NOW).status).toBe('overdue');
    const rs = [sampleReading('saliva', { crewMember: 'ana', takenAt: at(1), newId })];
    expect(sampleState(saliva, cfg, 12, rs, NOW)).toMatchObject({
      status: 'collected',
      dueDay: 10,
    });
    const old = [sampleReading('saliva', { crewMember: 'ana', takenAt: at(3), newId })];
    expect(sampleState(saliva, cfg, 12, old, NOW).status).toBe('overdue');
  });

  it('keeps the module of the last swab', () => {
    const rs = [
      sampleReading('surface-swab', {
        crewMember: 'ana',
        takenAt: at(0, 2),
        newId,
        module: 'galley',
      }),
    ];
    const states = sampleStates(cfg, 7, rs, NOW);
    expect(states.find((s) => s.sample === 'surface-swab')).toMatchObject({
      status: 'collected',
      last: { module: 'galley' },
    });
  });
});

describe('awaitingResults', () => {
  it('lists collections without a result, oldest first', () => {
    const a = sampleReading('blood', { crewMember: 'ana', takenAt: at(2), newId });
    const b = sampleReading('saliva', { crewMember: 'ana', takenAt: at(1), newId });
    const other = { ...a, id: 'x', indicator: 'heart-rate' };
    expect(awaitingResults([b, a, other], [{ id: a.id }])).toEqual([
      { id: b.id, sample: 'saliva', collectedAt: b.takenAt, crewMember: 'ana' },
    ]);
    expect(a.indicator).toBe(SAMPLE_INDICATOR);
  });
});
