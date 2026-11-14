import { describe, expect, it } from 'vitest';
import type { WatchEnvelope, WatchMessages } from '../contracts';
import { ACUTE_EPISODE_NOTE } from './baseline';
import { readingsFromEnvelope } from './watch-readings';

const emergency = (payload: WatchMessages['emergency']): WatchEnvelope<'emergency'> => ({
  v: 1,
  type: 'emergency',
  crewMember: 'elena-vega',
  simulated: false,
  sentAt: '2026-11-02T04:00:15Z',
  payload,
});

describe('readingsFromEnvelope · emergency', () => {
  it('turns the reading that fired a heart-rate trigger into a reading', () => {
    const [reading, ...rest] = readingsFromEnvelope(
      emergency({
        origin: 'heartRate',
        takenAt: '2026-11-02T04:00:15Z',
        heartRate: 168,
        readingAt: '2026-11-02T04:00:00Z',
      }),
    );
    expect(rest).toEqual([]);
    expect(reading).toMatchObject({
      indicator: 'heart-rate',
      value: 168,
      unit: 'bpm',
      takenAt: '2026-11-02T04:00:00Z',
      source: 'watch',
      crewMember: 'elena-vega',
      note: ACUTE_EPISODE_NOTE,
    });
  });

  it('uses the alert time when the SpO₂ reading has no time of its own', () => {
    const readings = readingsFromEnvelope(
      emergency({ origin: 'spo2', takenAt: '2026-11-02T04:00:15Z', spo2: 87 }),
    );
    expect(readings).toMatchObject([
      { indicator: 'spo2', value: 87, unit: '%', takenAt: '2026-11-02T04:00:15Z' },
    ]);
  });

  it('gives no reading for button, fall or rhythm alerts', () => {
    expect(
      readingsFromEnvelope(emergency({ origin: 'fall', takenAt: '2026-11-02T04:00:15Z' })),
    ).toEqual([]);
  });
});
