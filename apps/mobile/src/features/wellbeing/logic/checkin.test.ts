import { evaluate, evaluateZones, loadConfig, type Reading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import {
  buildCheckin,
  CHECKIN_COLLECTION,
  canSave,
  cleanJournal,
  JOURNAL_COLLECTION,
  JOURNAL_MAX,
  toggleContact,
} from './checkin';

const config = loadConfig();
const unitOf = (id: string) => config.indicators.find((i) => i.id === id)?.unit ?? '';

function checkin(stress: number, takenAt: string, journal = '') {
  let n = 0;
  return buildCheckin({
    mood: 4,
    stress,
    contact: ['crew'],
    journal,
    crewMember: 'elena-vega',
    takenAt,
    newId: () => `${takenAt}-${n++}`,
    unitOf,
  });
}

describe('collections', () => {
  it('names are valid db table names', () => {
    for (const n of [CHECKIN_COLLECTION, JOURNAL_COLLECTION]) expect(n).toMatch(/^[a-z0-9_]+$/);
  });
});

describe('contact', () => {
  it('"nobody" is exclusive', () => {
    expect(toggleContact(['crew'], ['crew', 'nobody'])).toEqual(['nobody']);
    expect(toggleContact(['nobody'], ['nobody', 'family'])).toEqual(['family']);
    expect(toggleContact(['crew', 'family'], ['family'])).toEqual(['family']);
    expect(toggleContact([], ['bogus'])).toEqual([]);
  });
});

describe('check-in', () => {
  it('needs both scales, or only contact/journal once today’s scales exist', () => {
    const base = { contact: [] as never[], journal: '', scalesDoneToday: false };
    expect(canSave({ ...base, mood: 4, stress: null })).toBe(false);
    expect(canSave({ ...base, mood: 4, stress: 6 })).toBe(false);
    expect(canSave({ ...base, mood: 1, stress: 5 })).toBe(true);
    expect(canSave({ ...base, journal: 'hola' })).toBe(false);
    expect(canSave({ ...base, scalesDoneToday: true, journal: '  ' })).toBe(false);
    expect(canSave({ ...base, scalesDoneToday: true, journal: 'hola' })).toBe(true);
    expect(canSave({ ...base, scalesDoneToday: true, contact: ['family'] as never[] })).toBe(true);
  });

  it('without scales it saves no reading, only the local part', () => {
    const c = buildCheckin({
      contact: ['family'],
      journal: 'x',
      crewMember: 'elena-vega',
      takenAt: '2026-11-01T08:00:00.000Z',
      newId: () => 'id',
      unitOf,
    });
    expect(c.readings).toEqual([]);
    expect(c.record.contact).toEqual(['family']);
    expect(c.journal?.text).toBe('x');
  });

  it('caps the journal at 3000 characters', () => {
    expect(cleanJournal(`  ${'a'.repeat(4000)}`)).toHaveLength(JOURNAL_MAX);
  });

  it('readings carry no journal; the journal is a separate entry', () => {
    const secret = 'Echo de menos a mi hermana';
    const c = checkin(2, '2026-11-01T08:00:00.000Z', secret);
    expect(c.readings.map((r) => [r.indicator, r.value, r.source, r.unit])).toEqual([
      ['mood', 4, 'screen', 'points (1–5)'],
      ['stress', 2, 'screen', 'points (1–5)'],
    ]);
    expect(JSON.stringify(c.readings)).not.toContain(secret);
    expect(JSON.stringify(c.record)).not.toContain(secret);
    expect(c.journal?.text).toBe(secret);
    expect(checkin(2, '2026-11-01T08:00:00.000Z').journal).toBeUndefined();
  });

  it('three check-ins in a row with stress 4 put Mind in amber; two do not; the journal never appears', () => {
    const secret = 'diario-privado-xyz';
    const days = [
      '2026-10-30T08:00:00.000Z',
      '2026-10-31T08:00:00.000Z',
      '2026-11-01T08:00:00.000Z',
    ];
    const readings: Reading[] = days.flatMap((d) => checkin(4, d, secret).readings);
    const now = new Date('2026-11-01T09:00:00.000Z');

    const two = evaluate(
      readings.slice(0, 4),
      config,
      'transit',
      {},
      [],
      new Date('2026-10-31T09:00:00.000Z'),
    );
    const mindTwo = evaluateZones(two, config).find((z) => z.zone === 'mind');
    expect(two.find((a) => a.indicator === 'stress')?.level).toBe('green');
    expect(mindTwo?.level).not.toBe('amber');

    const three = evaluate(readings, config, 'transit', {}, [], now);
    expect(three.find((a) => a.indicator === 'stress')?.level).toBe('amber');
    expect(evaluateZones(three, config).find((z) => z.zone === 'mind')?.level).toBe('amber');
    expect(JSON.stringify(three)).not.toContain(secret);
  });
});
