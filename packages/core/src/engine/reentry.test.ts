import { describe, expect, it } from 'vitest';
import { reentry } from '../config';
import {
  isReentry,
  ORTHOSTATIC_INDICATOR,
  orthostaticLevel,
  orthostaticReadings,
  orthostaticResult,
  parseOrthostatic,
  REENTRY_CHECK_INDICATOR,
  reentryCheckReading,
  reentryStatus,
} from './reentry';
import { NOW, reading } from './test-fixtures';

let n = 0;
const newId = () => `id${++n}`;
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();

describe('reentry config', () => {
  it('has bilingual checklist items with unique ids and coherent thresholds', () => {
    const ids = reentry.checklist.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('orthostatic-test');
    for (const item of reentry.checklist) {
      expect(item.name.es && item.name.en, item.id).toBeTruthy();
      expect(item.detail.es && item.detail.en, item.id).toBeTruthy();
    }
    const o = reentry.orthostatic;
    expect(o.amberRise).toBeLessThan(o.redRise);
    expect(o.supineSeconds).toBeGreaterThan(0);
    expect(o.standingSeconds).toBeGreaterThan(0);
    expect(reentry.windowHours).toBeGreaterThan(0);
    expect(reentry.source.length).toBeGreaterThan(10);
  });
});

describe('orthostatic test', () => {
  it('is green below the amber rise, amber from it and red from the red rise', () => {
    expect(orthostaticLevel(29, [], reentry)).toBe('green');
    expect(orthostaticLevel(30, [], reentry)).toBe('amber');
    expect(orthostaticLevel(40, [], reentry)).toBe('red');
  });

  it('is red with symptoms on standing whatever the rise', () => {
    expect(orthostaticLevel(5, ['dizziness'], reentry)).toBe('red');
    expect(orthostaticLevel(5, ['chest-pain'], reentry)).toBe('green');
  });

  it('computes the rounded rise', () => {
    expect(orthostaticResult(61.6, 95, [], reentry)).toMatchObject({ rise: 33, level: 'amber' });
  });

  it('saves both pulses, the rise, the symptoms and the checklist mark', () => {
    const rs = orthostaticReadings(
      { supine: 60, standing: 98, symptoms: ['dizziness'] },
      { crewMember: 'ana', takenAt: at(0), supineAt: at(5), newId },
    );
    expect(rs.map((r) => r.indicator)).toEqual([
      'heart-rate',
      'heart-rate',
      ORTHOSTATIC_INDICATOR,
      'symptom',
      REENTRY_CHECK_INDICATOR,
    ]);
    expect(rs[0]).toMatchObject({ value: 60, unit: 'bpm', takenAt: at(5) });
    expect(rs[2]?.value).toBe(38);
    const parsed = rs[2] ? parseOrthostatic(rs[2], reentry) : undefined;
    expect(parsed).toMatchObject({ supine: 60, standing: 98, rise: 38, level: 'red' });
    expect(parsed?.symptoms).toEqual(['dizziness']);
  });

  it('parses a reading without a note from its value', () => {
    const parsed = parseOrthostatic(reading(ORTHOSTATIC_INDICATOR, 12), reentry);
    expect(parsed).toMatchObject({ rise: 12, level: 'green', symptoms: [] });
  });
});

describe('reentryStatus', () => {
  const check = (item: string, minutesAgo: number) =>
    reentryCheckReading(item, { crewMember: 'ana', takenAt: at(minutesAgo), newId });

  it('is not started without readings', () => {
    const s = reentryStatus([], reentry, NOW);
    expect(s).toMatchObject({ done: 0, total: 3, readiness: 'not-started', level: 'pending' });
  });

  it('is in progress with part of the checklist and ready with all of it', () => {
    const partial = [check('fluid-loading', 30)];
    expect(reentryStatus(partial, reentry, NOW).readiness).toBe('in-progress');
    const all = [
      ...partial,
      check('compression-garment', 20),
      ...orthostaticReadings(
        { supine: 62, standing: 80, symptoms: [] },
        { crewMember: 'ana', takenAt: at(10), supineAt: at(15), newId },
      ),
    ];
    const s = reentryStatus(all, reentry, NOW);
    expect(s).toMatchObject({ done: 3, readiness: 'ready', level: 'green' });
    expect(s.orthostatic?.rise).toBe(18);
  });

  it('flags the orthostatic result before the checklist', () => {
    const rs = orthostaticReadings(
      { supine: 60, standing: 104, symptoms: [] },
      { crewMember: 'ana', takenAt: at(10), supineAt: at(15), newId },
    );
    expect(reentryStatus(rs, reentry, NOW)).toMatchObject({ readiness: 'unfit', level: 'red' });
  });

  it('ignores readings outside the window and in the future', () => {
    const old = check('fluid-loading', reentry.windowHours * 60 + 1);
    const future = check('compression-garment', -10);
    expect(reentryStatus([old, future], reentry, NOW).done).toBe(0);
  });

  it('knows the reentry environment', () => {
    expect(isReentry('reentry')).toBe(true);
    expect(isReentry('transit')).toBe(false);
    expect(isReentry(undefined)).toBe(false);
  });
});
