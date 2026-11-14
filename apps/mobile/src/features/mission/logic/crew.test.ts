import { DEMO_MISSION } from '@haven/core/testdata';
import { describe, expect, it } from 'vitest';
import {
  crewFromApi,
  crewIdFor,
  isValidCrewName,
  mergeCrew,
  missionCrew,
  withTypedCrewMember,
} from './crew';
import {
  decideJoin,
  findInApiResponse,
  type MissionRecord,
  missionFromRecord,
} from './mission-record';

const ana = {
  id: 'ana-ruiz',
  name: 'Ana Ruiz',
  hasWatch: false,
  role: { es: 'Comandante', en: 'Commander' },
};
const now = new Date('2026-11-01T10:00:00Z');

const record = (code: string, crew?: MissionRecord['crew']): MissionRecord => ({
  code,
  name: code,
  environment: 'mars',
  start: '2026-10-22',
  durationDays: 540,
  currentDelayMin: 11,
  createdAt: now.toISOString(),
  origin: 'local',
  crew,
});

describe('crew roster from Earth', () => {
  it('reads entries with an optional role and drops malformed or repeated ones', () => {
    expect(
      crewFromApi([
        ana,
        { id: 'leo-park', name: '  Leo Park ', hasWatch: true },
        { id: 'ana-ruiz', name: 'Duplicate' },
        { name: 'No id' },
        { id: 'kai', role: { es: 'Sin inglés' } },
        null,
      ]),
    ).toEqual([
      ana,
      { id: 'leo-park', name: 'Leo Park', hasWatch: true },
      { id: 'kai', name: 'kai', hasWatch: false },
    ]);
    expect(crewFromApi(undefined)).toEqual([]);
    expect(missionCrew([ana])).toEqual([{ id: 'ana-ruiz', name: 'Ana Ruiz', hasWatch: false }]);
  });

  it('keeps the roster when reading a mission of GET /api/missions', () => {
    const found = findInApiResponse(
      { missions: [{ code: 'ARES02', environment: 'mars', crew: [ana] }] },
      'ARES02',
    );
    expect(found?.crew).toEqual([ana]);
  });

  it('makes the roster the crew of the joined mission; old records keep the current crew', () => {
    expect(missionFromRecord(record('ARES02', [ana]), DEMO_MISSION, now).crew).toEqual([
      { id: 'ana-ruiz', name: 'Ana Ruiz', hasWatch: false },
    ]);
    expect(missionFromRecord(record('ARES02', []), DEMO_MISSION, now).crew).toEqual([]);
    expect(missionFromRecord(record('ARES02'), DEMO_MISSION, now).crew).toEqual(DEMO_MISSION.crew);
  });
});

describe('typed name', () => {
  it('gives the same id as Earth (accents, spaces, repeats)', () => {
    expect(crewIdFor('Ana Ruíz', [])).toBe('ana-ruiz');
    expect(crewIdFor('  José  M. Peña ', [])).toBe('jose-m-pena');
    expect(crewIdFor('Ana Ruiz', ['ana-ruiz', 'ana-ruiz-2'])).toBe('ana-ruiz-3');
    expect(crewIdFor('!!!', [])).toBe('crew');
  });

  it('validates the length', () => {
    expect(isValidCrewName(' A ')).toBe(false);
    expect(isValidCrewName('Al')).toBe(true);
    expect(isValidCrewName('x'.repeat(41))).toBe(false);
  });

  it('adds a new person or reuses the roster entry with the same name', () => {
    expect(withTypedCrewMember([], ' Leo   Park ')).toEqual({
      id: 'leo-park',
      crew: [{ id: 'leo-park', name: 'Leo Park', hasWatch: false }],
    });
    expect(withTypedCrewMember([ana], 'ana ruíz')).toEqual({ id: 'ana-ruiz', crew: [ana] });
  });

  it('keeps names typed here that Earth does not have yet', () => {
    const typed = { id: 'leo-park', name: 'Leo Park', hasWatch: false };
    expect(mergeCrew([ana], [typed, { ...ana, name: 'Old' }])).toEqual([ana, typed]);
    expect(mergeCrew([ana], undefined)).toEqual([ana]);
  });
});

describe('joining by code', () => {
  const earth = { ...record('ARES02', [ana]), origin: 'earth' as const };

  it('fails when Earth answers without the code and the phone does not know it', () => {
    expect(decideJoin(undefined, { status: 'missing' })).toEqual({ from: 'unknown' });
  });

  it('joins offline only when Earth cannot be reached', () => {
    expect(decideJoin(undefined, { status: 'unreachable' })).toEqual({ from: 'offline' });
  });

  it('prefers Earth, keeping names typed on this phone', () => {
    const typed = { id: 'leo-park', name: 'Leo Park', hasWatch: false };
    const decision = decideJoin(record('ARES02', [typed]), { status: 'found', record: earth });
    expect(decision).toMatchObject({ from: 'earth', record: { origin: 'earth' } });
    expect(decision.from === 'earth' && decision.record.crew).toEqual([ana, typed]);
  });

  it('joins a mission already on this phone even if Earth does not know it yet', () => {
    const local = record('KQ7MPA');
    expect(decideJoin(local, { status: 'missing' })).toEqual({ from: 'local', record: local });
    expect(decideJoin(local, { status: 'unreachable' })).toEqual({ from: 'local', record: local });
  });
});
