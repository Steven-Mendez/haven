import { DEMO_MISSION } from '@haven/core/testdata';
import { describe, expect, it } from 'vitest';
import {
  findInApiResponse,
  type MissionRecord,
  missionFromRecord,
  recordDay,
  recordStatus,
} from './mission-record';

const now = new Date('2026-11-10T10:00:00Z');

const record = (changes: Partial<MissionRecord> = {}): MissionRecord => ({
  code: 'MPY2UR',
  name: 'Ares-2',
  environment: 'mars',
  start: '2026-11-01',
  durationDays: 540,
  currentDelayMin: 11,
  createdAt: now.toISOString(),
  origin: 'earth',
  ...changes,
});

describe('mission states from Earth', () => {
  it('reads status, awaitingStart, finishedAt and the exact start from GET /api/missions', () => {
    const found = findInApiResponse(
      {
        missions: [
          {
            code: 'MPY2UR',
            environment: 'mars',
            status: 'planned',
            awaitingStart: true,
            start: '2026-12-03T09:00:00.000Z',
            day: 0,
          },
        ],
      },
      'MPY2UR',
    );
    expect(found).toMatchObject({
      status: 'planned',
      awaitingStart: true,
      start: '2026-12-03',
      startAt: '2026-12-03T09:00:00.000Z',
    });
    const bogus = findInApiResponse(
      { missions: [{ code: 'MPY2UR', environment: 'mars', status: 'paused' }] },
      'MPY2UR',
    );
    expect(bogus?.status).toBeUndefined();
  });

  it('treats records without a status as active (old installs, missions made on the phone)', () => {
    expect(recordStatus(record({ origin: 'local' }), now)).toBe('active');
    expect(recordDay(record({ origin: 'local' }), now)).toBe(10);
  });

  it('planned: no day until mission control starts it', () => {
    const planned = record({ status: 'planned', awaitingStart: true, start: '2026-11-01' });
    expect(recordStatus(planned, now)).toBe('planned');
    expect(recordDay(planned, now)).toBe(0);
  });

  it('scheduled: starts on its own at the start time, without asking Earth again', () => {
    const scheduled = record({
      status: 'scheduled',
      start: '2026-11-10',
      startAt: '2026-11-10T12:00:00Z',
    });
    expect(recordStatus(scheduled, now)).toBe('scheduled');
    expect(recordDay(scheduled, now)).toBe(0);
    const later = new Date('2026-11-10T12:30:00Z');
    expect(recordStatus(scheduled, later)).toBe('active');
    expect(recordDay(scheduled, later)).toBe(1);
  });

  it('finished: stays on its last day, by hand or at the end of the plan', () => {
    const byHand = record({ status: 'finished', finishedAt: '2026-11-05T08:00:00Z' });
    expect(recordStatus(byHand, now)).toBe('finished');
    expect(recordDay(byHand, now)).toBe(5);
    const ended = record({ status: 'active', durationDays: 7 });
    expect(recordStatus(ended, now)).toBe('finished');
    expect(recordDay(ended, now)).toBe(7);
  });

  it('puts name, status and start in the mission state', () => {
    const mission = missionFromRecord(record({ status: 'planned' }), DEMO_MISSION, now);
    expect(mission).toMatchObject({
      code: 'MPY2UR',
      name: 'Ares-2',
      status: 'planned',
      start: '2026-11-01',
      day: 0,
    });
    expect(missionFromRecord(record({ status: 'active' }), DEMO_MISSION, now)).toMatchObject({
      status: 'active',
      day: 10,
    });
  });
});
