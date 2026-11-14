import type { Assessment, Reading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import {
  buildEmergencyPacket,
  emergencyReadings,
  normalizeOrigin,
  type PacketInput,
  packetSummary,
  SYMPTOM_LIST,
  symptomReading,
} from './packet';

const now = new Date('2026-11-01T10:10:00Z');
const startedAt = new Date('2026-11-01T10:00:00Z');
const min = (m: number) => new Date(startedAt.getTime() + m * 60_000).toISOString();

function reading(
  id: string,
  indicator: string,
  value: number,
  takenAt: string,
  crewMember = 'elena-vega',
): Reading {
  return { id, indicator, value, unit: '', takenAt, source: 'watch', simulated: false, crewMember };
}

const assessment: Assessment = {
  indicator: 'heart-rate',
  level: 'red',
  value: 170,
  explanation: { es: 'x', en: 'x' },
  actions: [],
  ageMin: 0,
  simulated: false,
};

function input(overrides: Partial<PacketInput> = {}): PacketInput {
  return {
    id: 'p1',
    crewMember: 'elena-vega',
    missionCode: 'ARES01',
    assessments: [assessment, { ...assessment, indicator: 'glucose', level: 'pending' }],
    readings: [
      reading('old', 'heart-rate', 70, min(-31)),
      reading('onset', 'heart-rate', 96, min(-3)),
      reading('live', 'heart-rate', 170, min(5)),
      reading('spo2', 'spo2', 93, min(5)),
      reading('other', 'heart-rate', 80, min(5), 'mateo-rios'),
      reading('future', 'heart-rate', 80, min(11)),
    ],
    symptoms: [],
    startedAt,
    now,
    notes: '  Lost consciousness at 10:00  ',
    decisions: ['10:00:01 · ¿Responde? → No responde'],
    originLabel: 'Origen: caída detectada',
    photos: [],
    ...overrides,
  };
}

describe('symptom readings', () => {
  it('follow the glossary: indicator symptom, source screen', () => {
    expect(SYMPTOM_LIST).toContain('chest-pain');
    const r = symptomReading('sweating', 'elena-vega', now, 's1');
    expect(r).toMatchObject({
      id: 's1',
      indicator: 'symptom',
      value: 'sweating',
      source: 'screen',
      simulated: false,
      crewMember: 'elena-vega',
      takenAt: now.toISOString(),
    });
  });
});

describe('emergency packet', () => {
  it('keeps the emergency window of the crew member, sorted and deduplicated', () => {
    const list = emergencyReadings(
      [...input().readings, reading('live', 'heart-rate', 170, min(5))],
      'elena-vega',
      startedAt,
      now,
    );
    expect(list.map((r) => r.id)).toEqual(['onset', 'live', 'spo2']);
  });

  it('builds a complete emergency packet without artificial delay', () => {
    const symptom = symptomReading('chest-pain', 'elena-vega', new Date(min(2)), 's1');
    const again = symptomReading('chest-pain', 'elena-vega', new Date(min(3)), 's2');
    const packet = buildEmergencyPacket(
      input({
        symptoms: [symptom, again],
        photos: [{ uri: 'data:image/jpeg;base64,AAA', takenAt: min(4), note: 'aed-pads' }],
        ecg: { hz: 512, microvolts: [1, 2, 3] },
      }),
    );
    expect(packet).toMatchObject({
      id: 'p1',
      type: 'emergency',
      crewMember: 'elena-vega',
      mission: 'ARES01',
      createdAt: startedAt.toISOString(),
      sentAt: now.toISOString(),
      visibleAt: now.toISOString(),
    });
    expect(packet.readings.map((r) => r.id)).toEqual(['onset', 's1', 's2', 'live', 'spo2']);
    expect(packet.notes).toBe(
      'Origen: caída detectada\n\nLost consciousness at 10:00\n\n10:00:01 · ¿Responde? → No responde',
    );
    expect(packet.photos).toHaveLength(1);
    expect(packet.ecg?.hz).toBe(512);
    expect(packetSummary(packet)).toEqual({
      measurements: 3,
      symptoms: 1,
      photos: 1,
      ecg: true,
      assessments: 1,
    });
  });

  it('carries no ECG unless a real one is given, and omits empty photos', () => {
    const packet = buildEmergencyPacket(input());
    expect(packet.ecg).toBeUndefined();
    expect(packet.photos).toBeUndefined();
    expect(packetSummary(packet).ecg).toBe(false);
    expect(buildEmergencyPacket(input({ ecg: { hz: 512, microvolts: [] } })).ecg).toBeUndefined();
  });

  it('normalizes the origin', () => {
    expect(normalizeOrigin('fall')).toBe('fall');
    expect(normalizeOrigin('assessment')).toBe('assessment');
    expect(normalizeOrigin('nope')).toBeUndefined();
  });
});
