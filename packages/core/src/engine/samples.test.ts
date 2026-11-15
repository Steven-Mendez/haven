import { describe, expect, it } from 'vitest';
import { sampleConfig as cfg, loadConfig } from '../config';
import {
  awaitingResults,
  classifySample,
  collectionDays,
  parseCollection,
  SAMPLE_INDICATOR,
  type SampleResult,
  sampleAge,
  sampleContext,
  sampleHistory,
  sampleReading,
  sampleState,
  sampleStates,
} from './samples';

const NOW = new Date('2026-11-14T12:00:00.000Z');
let n = 0;
const newId = () => `s${++n}`;
const at = (daysAgo: number, hours = 0) =>
  new Date(NOW.getTime() - daysAgo * 86_400_000 - hours * 3_600_000).toISOString();
const indicators = new Set(loadConfig().indicators.map((i) => i.id));
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
      expect(s.maxAgeDays, s.id).toBeGreaterThan(0);
      expect(s.analytes.length, s.id).toBeGreaterThan(0);
      for (const a of s.analytes) {
        expect(a.name.es && a.name.en && a.unit, `${s.id}.${a.id}`).toBeTruthy();
        expect(a.red[0], a.id).toBeLessThanOrEqual(a.green[0]);
        expect(a.red[1], a.id).toBeGreaterThanOrEqual(a.green[1]);
      }
      for (const q of s.questions) {
        expect(q.label.es && q.label.en, q.id).toBeTruthy();
        expect(q.options.length, q.id).toBeGreaterThan(1);
      }
      for (const id of s.context) expect(indicators.has(id), `${s.id} → ${id}`).toBe(true);
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
      { id: b.id, sample: 'saliva', collectedAt: b.takenAt, crewMember: 'ana', answers: {} },
    ]);
    expect(a.indicator).toBe(SAMPLE_INDICATOR);
  });
});

describe('collection details', () => {
  it('keeps module, answers and comment, and reads them back', () => {
    const r = sampleReading('blood', {
      crewMember: 'ana',
      takenAt: at(0),
      newId,
      answers: { fasting: 'no', storage: 'frozen' },
      comment: 'Costó; 2 intentos = moretón',
    });
    expect(parseCollection(r)).toMatchObject({
      sample: 'blood',
      answers: { fasting: 'no', storage: 'frozen' },
      comment: 'Costó; 2 intentos = moretón',
    });
    const swab = sampleReading('surface-swab', {
      crewMember: 'ana',
      takenAt: at(0),
      newId,
      module: 'galley',
    });
    expect(parseCollection(swab)).toMatchObject({ module: 'galley', answers: {} });
  });
});

describe('classifySample', () => {
  const blood = cfg.samples.find((s) => s.id === 'blood');
  if (!blood) throw new Error('blood');

  it('is normal inside the reference, abnormal outside it and critical outside the red range', () => {
    expect(classifySample(blood, { wbc: 6, glucose: 90 }).level).toBe('normal');
    expect(classifySample(blood, { wbc: 3, glucose: 90 })).toMatchObject({
      level: 'abnormal',
      flags: [
        { analyte: 'wbc', value: 3, level: 'abnormal' },
        { analyte: 'glucose', value: 90, level: 'normal' },
      ],
    });
    expect(classifySample(blood, { wbc: 6, glucose: 300 }).level).toBe('critical');
  });

  it('has no level without values', () => {
    expect(classifySample(blood, {})).toEqual({ flags: [] });
  });
});

describe('sampleContext', () => {
  it('takes the latest context reading and the symptoms around the collection', () => {
    const base = { unit: '°C', source: 'manual' as const, simulated: false, crewMember: 'ana' };
    const rs = [
      { ...base, id: 'a', indicator: 'body-temperature', value: 36.6, takenAt: at(0, 20) },
      { ...base, id: 'b', indicator: 'body-temperature', value: 38.1, takenAt: at(0, 4) },
      { ...base, id: 'c', indicator: 'body-temperature', value: 39, takenAt: at(0, 30) },
      {
        ...base,
        id: 'd',
        indicator: 'symptom',
        value: 'fever-chills',
        unit: '',
        takenAt: at(0, 3),
      },
      { ...base, id: 'e', indicator: 'stress', value: 4, unit: '', takenAt: at(0, -2) },
    ];
    expect(sampleContext(saliva, rs, at(0, 2))).toEqual({
      readings: [{ indicator: 'body-temperature', value: 38.1, unit: '°C', takenAt: at(0, 4) }],
      symptoms: ['fever-chills'],
    });
  });
});

describe('sampleHistory and sampleAge', () => {
  const result = (id: string, daysAgo: number, crewMember = 'ana'): SampleResult => ({
    id,
    mission: 'M',
    crewMember,
    sample: 'saliva',
    collectedAt: at(daysAgo),
    result: 'normal',
    enteredAt: at(daysAgo),
  });

  it('lists earlier results of the same crew member and sample, newest first', () => {
    const all = [result('1', 20), result('2', 13), result('3', 6), result('x', 6, 'otro')];
    expect(sampleHistory(all, 'ana', 'saliva', at(10)).map((r) => r.id)).toEqual(['2', '1']);
  });

  it('flags a sample older than its limit', () => {
    expect(sampleAge(saliva, at(3), NOW)).toEqual({ days: 3, stale: false });
    expect(sampleAge(saliva, at(31), NOW)).toEqual({ days: 31, stale: true });
  });
});
