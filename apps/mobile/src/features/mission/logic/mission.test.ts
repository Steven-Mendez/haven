import { type Environment, loadConfig } from '@haven/core';
import { DEMO_MISSION } from '@haven/core/testdata';
import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET,
  generateMissionCode,
  generateUniqueMissionCode,
  isValidMissionCode,
  normalizeMissionCode,
} from './code';
import {
  clampDelay,
  defaultDelay,
  delayForDestination,
  delayForEnvironment,
  delayParts,
} from './environment';
import {
  findInApiResponse,
  missionDay,
  missionFromRecord,
  parseIsoDate,
  recordFromDraft,
  startForDay,
  toApiBody,
  validateDraft,
} from './mission-record';
import { driftPercent, isPlausible, mergePreflight, parseMeasure } from './preflight';

const config = loadConfig();
const env = (id: string) => config.environments.find((e) => e.id === id) as Environment;

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('mission code', () => {
  it('generates six characters from the unambiguous alphabet, valid for the Earth API', () => {
    const random = seeded(7);
    for (let i = 0; i < 200; i++) {
      const code = generateMissionCode(random);
      expect(code).toHaveLength(6);
      expect(isValidMissionCode(code)).toBe(true);
      for (const c of code) expect(CODE_ALPHABET).toContain(c);
    }
  });

  it('is deterministic with an injected random source and handles random() = 1', () => {
    expect(generateMissionCode(seeded(3))).toBe(generateMissionCode(seeded(3)));
    expect(generateMissionCode(() => 0.999999)).toBe(
      '999999'.replace(/9/g, CODE_ALPHABET.at(-1) as string),
    );
    expect(isValidMissionCode(generateMissionCode(() => 1))).toBe(true);
  });

  it('avoids codes already taken', () => {
    const first = generateMissionCode(seeded(5));
    expect(generateUniqueMissionCode([first], seeded(5))).not.toBe(first);
  });

  it('normalizes typed input and validates', () => {
    expect(normalizeMissionCode(' ares-01 ')).toBe('ARES01');
    expect(normalizeMissionCode('abcdefgh')).toBe('ABCDEF');
    expect(isValidMissionCode('ARES01')).toBe(true);
    expect(isValidMissionCode('ARES0')).toBe(false);
    expect(isValidMissionCode('ares01')).toBe(false);
    expect(isValidMissionCode('ARES-1')).toBe(false);
  });
});

describe('environment delay', () => {
  it('keeps the delay inside the environment range', () => {
    expect(clampDelay(env('mars'), 40)).toBe(22);
    expect(clampDelay(env('mars'), 1)).toBe(3);
    expect(clampDelay(env('mars'), 11)).toBe(11);
    expect(clampDelay(env('station'), 5)).toBe(0.02);
    expect(clampDelay(env('mars'), Number.NaN)).toBe(11);
  });

  it('defaults Mars and transit to 11 min (first destination), rover to the middle of its range', () => {
    expect(defaultDelay(env('mars'))).toBe(11);
    expect(defaultDelay(env('transit'))).toBe(11);
    expect(defaultDelay(env('rover'))).toBe(13);
    expect(defaultDelay(env('moon'))).toBe(0.0213);
  });

  it('switching environment keeps a delay that still fits, otherwise uses the default', () => {
    expect(delayForEnvironment(env('mars'), 11)).toBe(11);
    expect(delayForEnvironment(env('mars'), 0.02)).toBe(11);
    expect(delayForEnvironment(env('station'), 11)).toBe(0);
  });

  it('every config environment and destination delay is within range', () => {
    for (const e of config.environments) {
      const d = defaultDelay(e);
      expect(d).toBeGreaterThanOrEqual(Math.min(e.delayMin, e.delayMax));
      expect(d).toBeLessThanOrEqual(Math.max(e.delayMin, e.delayMax));
      for (const dest of e.destinations ?? []) {
        const dd = delayForDestination(e, dest);
        expect(dd).toBeGreaterThanOrEqual(e.delayMin);
        expect(dd).toBeLessThanOrEqual(e.delayMax);
      }
    }
  });

  it('formats the delay in minutes or seconds', () => {
    expect(delayParts(11)).toEqual({ value: 11, unit: 'min' });
    expect(delayParts(0.02)).toEqual({ value: 1, unit: 's' });
    expect(delayParts(0)).toEqual({ value: 1, unit: 's', lessThan: true });
  });
});

describe('mission records', () => {
  const now = new Date('2026-11-01T10:00:00Z');

  it('computes the mission day from the start date and back', () => {
    expect(missionDay('2026-11-01', now)).toBe(1);
    expect(missionDay('2026-10-01', now)).toBe(32);
    expect(missionDay('2027-01-01', now)).toBe(1);
    expect(missionDay(startForDay(142, now), now)).toBe(142);
    expect(parseIsoDate('2026-02-30')).toBeUndefined();
  });

  it('validates the create form', () => {
    const ok = { name: 'Ares-2', environment: 'mars', start: '2026-11-01', durationDays: '540' };
    expect(validateDraft(ok, config.environments)).toEqual([]);
    expect(
      validateDraft(
        { name: 'A', environment: 'pluto', start: '1/11/2026', durationDays: '0' },
        config.environments,
      ),
    ).toEqual(['name', 'environment', 'start', 'duration']);
  });

  it('builds a record and the Mission state, keeping link and crew', () => {
    const draft = { name: ' Ares-2 ', environment: 'mars', start: '2026-10-22', durationDays: 540 };
    const record = recordFromDraft(draft, 'KQ7MPA', env('mars'), now);
    expect(record).toMatchObject({
      code: 'KQ7MPA',
      name: 'Ares-2',
      currentDelayMin: 11,
      origin: 'local',
    });
    const mission = missionFromRecord(record, { ...DEMO_MISSION, linkDown: true }, now);
    expect(mission).toMatchObject({ code: 'KQ7MPA', environment: 'mars', day: 11, linkDown: true });
    expect(mission.crew).toEqual(DEMO_MISSION.crew);
    expect(toApiBody(record, mission.crew)).toMatchObject({ code: 'KQ7MPA', durationDays: 540 });
  });

  it('finds a mission by code in the Earth API response', () => {
    const response = {
      missions: [
        {
          code: 'ARES01',
          name: 'Ares-1',
          environment: 'transit',
          day: 142,
          currentDelayMin: 11,
          durationDays: 540,
        },
        { code: 'bad' },
      ],
    };
    const found = findInApiResponse(response, 'ARES01');
    expect(found).toMatchObject({
      code: 'ARES01',
      name: 'Ares-1',
      environment: 'transit',
      origin: 'earth',
    });
    expect(found && missionDay(found.start, new Date())).toBe(142);
    expect(findInApiResponse(response, 'ZZZZZZ')).toBeUndefined();
    expect(findInApiResponse(null, 'ARES01')).toBeUndefined();
  });
});

describe('pre-flight baseline', () => {
  it('parses decimal commas and computes the drift since launch', () => {
    expect(parseMeasure('61,5')).toBe(61.5);
    expect(parseMeasure('')).toBeUndefined();
    expect(parseMeasure('abc')).toBeUndefined();
    expect(driftPercent(66, 69.3)).toBe(5);
    expect(driftPercent(undefined, 69)).toBeUndefined();
    expect(isPlausible(66, [50, 100])).toBe(true);
    expect(isPlausible(900, [50, 100])).toBe(false);
  });

  it('merges edits and removes cleared values', () => {
    const now = new Date('2026-11-01T00:00:00Z');
    const first = mergePreflight(
      undefined,
      'elena-vega',
      { 'heart-rate': '66', weight: '61' },
      now,
    );
    expect(first.values).toEqual({ 'heart-rate': 66, weight: 61 });
    const next = mergePreflight(first, 'elena-vega', { weight: '' }, now);
    expect(next.values).toEqual({ 'heart-rate': 66 });
  });
});

describe('mission phases from Earth', () => {
  const base = { code: 'ABCDEF', environment: 'moon', day: 8, start: '2026-03-01' };

  it('keeps a valid phase plan and carries it into the mission', () => {
    const phases = [
      { environment: 'launch', days: 1 },
      { environment: 'moon', days: 10 },
    ];
    const record = findInApiResponse([{ ...base, phases }], 'ABCDEF');
    expect(record?.phases).toEqual(phases);
    if (!record) throw new Error('no record');
    expect(
      missionFromRecord(record, DEMO_MISSION, new Date('2026-03-08T12:00:00Z')).phases,
    ).toEqual(phases);
  });

  it('drops a malformed plan', () => {
    const record = findInApiResponse(
      [{ ...base, phases: [{ environment: 'moon', days: 'ten' }] }],
      'ABCDEF',
    );
    expect(record).toBeDefined();
    expect(record?.phases).toBeUndefined();
  });
});
