import { describe, expect, it } from 'vitest';
import { eva, loadConfig, SYMPTOMS } from '../config';
import {
  canPerformEva,
  EVA_CHECK_INDICATOR,
  evaPrepStatus,
  PREBREATHE_INDICATOR,
  parsePrebreathe,
  postEvaReadings,
  prebreatheMethods,
  prebreatheReading,
} from './eva';
import { NOW } from './test-fixtures';

const config = loadConfig();
const protocolIds = new Set(config.protocols.map((p) => p.id));

let n = 0;
const newId = () => `id${++n}`;
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
const opts = (minutesAgo: number) => ({ crewMember: 'ana', takenAt: at(minutesAgo), newId });
const method = (id: string) => {
  const m = eva.methods.find((x) => x.id === id);
  if (!m) throw new Error(id);
  return m;
};

describe('eva config', () => {
  it('has bilingual methods with unique ids, positive minutes and known environments', () => {
    const ids = eva.methods.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const envs = new Set(config.environments.map((e) => e.id));
    for (const m of eva.methods) {
      expect(m.name.es && m.name.en && m.detail.es && m.detail.en, m.id).toBeTruthy();
      expect(m.minutes, m.id).toBeGreaterThan(0);
      for (const e of m.environments) expect(envs.has(e), `${m.id} → ${e}`).toBe(true);
    }
  });

  it('uses known symptoms and an existing protocol after the EVA', () => {
    for (const s of eva.postEva.symptoms) expect(SYMPTOMS as readonly string[]).toContain(s);
    expect(protocolIds.has(eva.postEva.protocol)).toBe(true);
  });
});

describe('prebreathe', () => {
  it('offers the methods of the environment', () => {
    expect(prebreatheMethods('station', eva).map((m) => m.id)).toEqual([
      'exercise',
      'isle',
      'campout',
    ]);
    expect(prebreatheMethods('moon', eva).map((m) => m.id)).toEqual(['exploration']);
    expect(canPerformEva('reentry', eva)).toBe(false);
    expect(canPerformEva('mars', eva)).toBe(true);
  });

  it('saves the minutes breathed with the method and parses them back', () => {
    const r = prebreatheReading({ method: method('isle'), startedAt: at(105) }, opts(0));
    expect(r).toMatchObject({ indicator: PREBREATHE_INDICATOR, value: 105, unit: 'min' });
    expect(parsePrebreathe(r, eva)).toMatchObject({
      method: 'isle',
      minutes: 105,
      required: 100,
      complete: true,
      startedAt: at(105),
    });
  });

  it('marks a short prebreathe as incomplete', () => {
    const r = prebreatheReading({ method: method('exercise'), startedAt: at(40) }, opts(0));
    expect(parsePrebreathe(r, eva)).toMatchObject({ minutes: 40, required: 120, complete: false });
  });
});

describe('post-EVA check', () => {
  it('is clear without symptoms and saves one reading per symptom otherwise', () => {
    expect(postEvaReadings([], opts(0)).map((r) => r.value)).toEqual(['clear']);
    const rs = postEvaReadings(['joint-pain', 'dizziness'], opts(0));
    expect(rs.map((r) => r.indicator)).toEqual([EVA_CHECK_INDICATOR, 'symptom', 'symptom']);
    expect(rs[0]?.value).toBe('symptoms');
  });
});

describe('evaPrepStatus', () => {
  it('is none without readings', () => {
    expect(evaPrepStatus([], eva, NOW)).toMatchObject({ readiness: 'none', level: 'pending' });
  });

  it('follows prebreathe, then the check of the same EVA', () => {
    const pre = prebreatheReading({ method: method('campout'), startedAt: at(400) }, opts(320));
    expect(evaPrepStatus([pre], eva, NOW).readiness).toBe('prebreathing-done');
    const clear = postEvaReadings([], opts(10));
    expect(evaPrepStatus([pre, ...clear], eva, NOW)).toMatchObject({
      readiness: 'cleared',
      level: 'green',
    });
    const sick = postEvaReadings(['joint-pain'], opts(5));
    expect(evaPrepStatus([pre, ...clear, ...sick], eva, NOW)).toMatchObject({
      readiness: 'symptoms',
      level: 'red',
    });
  });

  it('is amber after an incomplete prebreathe and ignores a check from an earlier EVA', () => {
    const oldCheck = postEvaReadings(['joint-pain'], opts(600));
    const pre = prebreatheReading({ method: method('isle'), startedAt: at(60) }, opts(0));
    expect(evaPrepStatus([...oldCheck, pre], eva, NOW)).toMatchObject({
      readiness: 'incomplete',
      level: 'amber',
    });
  });

  it('ignores readings outside the window', () => {
    const pre = prebreatheReading(
      { method: method('isle'), startedAt: at(eva.windowHours * 60 + 200) },
      opts(eva.windowHours * 60 + 1),
    );
    expect(evaPrepStatus([pre], eva, NOW).readiness).toBe('none');
  });
});
