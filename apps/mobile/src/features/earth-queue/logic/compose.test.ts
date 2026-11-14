import type { Assessment, Packet, Reading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import {
  applyExclusions,
  composeRoutinePacket,
  DEFAULT_EXCLUSIONS,
  MAX_PER_INDICATOR,
  normalizeIncoming,
  recentReadings,
  summarize,
} from './compose';

const NOW = new Date('2026-11-01T12:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

let n = 0;
function reading(indicator: string, h: number, extra: Partial<Reading> = {}): Reading {
  n++;
  return {
    id: `r${n}`,
    indicator,
    value: 1,
    unit: 'u',
    takenAt: hoursAgo(h),
    source: 'manual',
    simulated: false,
    crewMember: 'elena-vega',
    ...extra,
  };
}

function assessment(indicator: string): Assessment {
  return {
    indicator,
    level: 'green',
    value: 3,
    explanation: { es: '', en: '' },
    actions: [],
    ageMin: 1,
    simulated: false,
  };
}

function routine(): Packet {
  return composeRoutinePacket({
    id: 'p1',
    mission: { code: 'ARES01' },
    crewMember: 'elena-vega',
    assessments: [assessment('heart-rate'), assessment('mood'), assessment('stress')],
    readings: [
      reading('heart-rate', 1, { note: 'after exercise' }),
      reading('mood', 2),
      reading('stress', 2),
      reading('diary', 3, { value: 'private words' }),
      reading('heart-rate', 30), // too old
      reading('heart-rate', 1, { crewMember: 'mateo-rios' }), // someone else
    ],
    dailyProgress: [{ zone: 'heart', progress: 1 }],
    notes: '  Slept badly  ',
    now: NOW,
  });
}

describe('composeRoutinePacket', () => {
  it('carries assessments, recent own readings, dailyProgress and the mission code', () => {
    const p = routine();
    expect(p.type).toBe('routine');
    expect(p.mission).toBe('ARES01');
    expect(p.dailyProgress).toEqual([{ zone: 'heart', progress: 1 }]);
    expect(p.notes).toBe('Slept badly');
    expect(p.readings.map((r) => r.indicator)).toEqual(['diary', 'mood', 'stress', 'heart-rate']);
    expect(p.readings.every((r) => r.crewMember === 'elena-vega')).toBe(true);
    expect(p.createdAt).toBe(NOW.toISOString());
  });

  it('caps readings per indicator', () => {
    const many = Array.from({ length: MAX_PER_INDICATOR + 10 }, (_, i) =>
      reading('heart-rate', i / 10),
    );
    expect(recentReadings(many, NOW)).toHaveLength(MAX_PER_INDICATOR);
  });
});

describe('applyExclusions', () => {
  it('excludes the private diary by default', () => {
    const p = applyExclusions(routine(), DEFAULT_EXCLUSIONS);
    expect(p.readings.some((r) => r.indicator === 'diary')).toBe(false);
    expect(p.notes).toBe('Slept badly');
    expect(p.readings.some((r) => r.indicator === 'mood')).toBe(true);
  });

  it('the diary travels only if included', () => {
    const p = applyExclusions(routine(), { notes: false, mood: false, diary: false });
    expect(p.readings.some((r) => r.indicator === 'diary')).toBe(true);
  });

  it('excluding notes clears the packet note and every reading and photo note', () => {
    const base = { ...routine(), photos: [{ uri: 'x', takenAt: NOW.toISOString(), note: 'n' }] };
    const p = applyExclusions(base, { notes: true, mood: false, diary: true });
    expect(p.notes).toBe('');
    expect(p.readings.some((r) => 'note' in r)).toBe(false);
    expect(p.photos?.[0]).toEqual({ uri: 'x', takenAt: NOW.toISOString() });
    expect(summarize(p).notes).toBe(0);
  });

  it('excluding mood drops mood and stress readings and assessments', () => {
    const p = applyExclusions(routine(), { notes: false, mood: true, diary: true });
    expect(p.readings.some((r) => r.indicator === 'mood' || r.indicator === 'stress')).toBe(false);
    expect(p.assessments.map((a) => a.indicator)).toEqual(['heart-rate']);
  });

  it('emergency packets travel complete', () => {
    const emergency: Packet = { ...routine(), type: 'emergency' };
    expect(applyExclusions(emergency, { notes: true, mood: true, diary: true })).toBe(emergency);
  });
});

describe('summarize and normalizeIncoming', () => {
  it('counts each kind of content', () => {
    expect(summarize(routine())).toMatchObject({
      assessments: 3,
      readings: 3,
      notes: 2,
      mood: 2,
      diary: 1,
      zones: 1,
    });
  });

  it('fills missing fields without removing content', () => {
    const p = normalizeIncoming(
      { type: 'emergency', readings: [reading('spo2', 0)], ecg: { hz: 250, microvolts: [1, 2] } },
      { id: 'gen', crewMember: 'elena-vega', mission: 'ARES01', now: NOW },
    );
    expect(p).toMatchObject({ id: 'gen', crewMember: 'elena-vega', mission: 'ARES01', notes: '' });
    expect(p.readings).toHaveLength(1);
    expect(p.ecg?.microvolts).toEqual([1, 2]);
    expect(p.createdAt).toBe(NOW.toISOString());
  });
});
