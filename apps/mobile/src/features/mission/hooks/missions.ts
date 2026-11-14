import type { Mission } from '@haven/core';
import { useCallback, useEffect, useState } from 'react';
import { config } from '@/shared/config';
import { store, useMission } from '@/shared/data';
import { db } from '@/shared/db';
import { generateUniqueMissionCode } from '../logic/code';
import { type CrewOption, missionCrew, withTypedCrewMember } from '../logic/crew';
import { defaultDelay } from '../logic/environment';
import {
  decideJoin,
  type EarthLookup,
  findInApiResponse,
  type MissionDraft,
  type MissionRecord,
  missionFromRecord,
  recordFromDraft,
  startForDay,
  toApiBody,
} from '../logic/mission-record';

const collection = db.collection<MissionRecord>('missions');
const TIMEOUT_MS = 4_000;
const DEFAULT_DURATION_DAYS = 540;

async function request(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function apiBase(): string | undefined {
  const url = store.preferences().apiUrl?.trim().replace(/\/+$/, '');
  return url ? url : undefined;
}

export async function testEarthApi(): Promise<'ok' | 'fail' | 'skipped'> {
  const base = apiBase();
  if (!base) return 'skipped';
  try {
    await request(`${base}/api/health`);
    return 'ok';
  } catch {
    return 'fail';
  }
}

export type JoinResult =
  | { record: MissionRecord; from: 'local' | 'earth' | 'offline' }
  | { from: 'unknown' }
  | { from: 'unreachable' };
export type CreateResult = { record: MissionRecord; registered: boolean };

async function lookUp(code: string): Promise<EarthLookup> {
  const base = apiBase();
  if (!base) return { status: 'unreachable' };
  let response: unknown;
  try {
    response = await request(`${base}/api/missions`);
  } catch {
    return { status: 'unreachable' };
  }
  const record = findInApiResponse(response, code);
  return record ? { status: 'found', record } : { status: 'missing' };
}

function missionCrewOptions(): CrewOption[] {
  return store.mission().crew.map(({ id, name, hasWatch }) => ({ id, name, hasWatch }));
}

const synced = (m: Mission) =>
  JSON.stringify([
    m.code,
    m.name,
    m.status,
    m.start,
    m.environment,
    m.day,
    m.currentDelayMin,
    m.crew,
  ]);

export async function syncCurrentMission(): Promise<boolean> {
  const current = store.mission();
  const local = await collection.get(current.code).catch(() => undefined);
  const lookup = await lookUp(current.code);
  let record = local;
  if (lookup.status === 'found') {
    const decision = decideJoin(local, lookup);
    if (decision.from === 'earth' && JSON.stringify(decision.record) !== JSON.stringify(local)) {
      record = decision.record;
      await collection.put(record.code, record);
    } else if (decision.from === 'earth') {
      record = decision.record;
    }
  }
  if (!record) return false;
  if (store.mission().code !== record.code) return false;
  const next = missionFromRecord(record, store.mission(), new Date());
  if (synced(next) === synced(store.mission())) return false;
  await store.setMission(next);
  return true;
}

export function useMissionRecords() {
  const [records, setRecords] = useState<MissionRecord[]>([]);

  const refresh = useCallback(async () => {
    try {
      setRecords(await collection.all());
    } catch (error) {
      console.warn('[mission] could not load missions', error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mission = useMission();
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when the mission state changes
  useEffect(() => {
    void refresh();
  }, [mission, refresh]);
  useEffect(() => {
    void syncCurrentMission().then(() => refresh());
  }, [refresh]);

  const recordFor = useCallback(
    (code: string): MissionRecord | undefined => records.find((r) => r.code === code),
    [records],
  );

  async function save(record: MissionRecord) {
    await collection.put(record.code, record);
    await refresh();
  }

  async function apply(record: MissionRecord) {
    await store.setMission(missionFromRecord(record, store.mission(), new Date()));
  }

  async function join(code: string, { allowOffline = true } = {}): Promise<JoinResult> {
    const known = recordFor(code) ?? (await collection.get(code).catch(() => undefined));
    const decision = decideJoin(known, await lookUp(code));
    if (decision.from === 'unknown') return { from: 'unknown' };
    if (decision.from === 'offline' && !allowOffline) return { from: 'unreachable' };
    if (decision.from !== 'offline') {
      await save(decision.record);
      await apply(decision.record);
      return decision;
    }
    const current = store.mission();
    const environment = config.environments.find((e) => e.id === current.environment);
    const now = new Date();
    const offline: MissionRecord = {
      code,
      name: code,
      environment: current.environment,
      start: startForDay(1, now),
      durationDays: environment?.destinations?.[0]?.durationDays ?? DEFAULT_DURATION_DAYS,
      currentDelayMin: environment ? defaultDelay(environment) : current.currentDelayMin,
      createdAt: now.toISOString(),
      origin: 'local',
      crew: [],
    };
    await save(offline);
    await apply(offline);
    return { record: offline, from: 'offline' };
  }

  async function chooseCrewMember(id: string) {
    await store.setPreferences({ crewMember: id });
  }

  async function addTypedCrewMember(code: string, name: string): Promise<string> {
    const record = recordFor(code) ?? (await collection.get(code).catch(() => undefined));
    const { crew, id } = withTypedCrewMember(record?.crew ?? missionCrewOptions(), name);
    if (record) await save({ ...record, crew });
    await store.setMission({ crew: missionCrew(crew) });
    await chooseCrewMember(id);
    return id;
  }

  async function create(draft: MissionDraft): Promise<CreateResult> {
    const environment = config.environments.find((e) => e.id === draft.environment);
    if (!environment) throw new Error(`Unknown environment ${draft.environment}`);
    const taken = [...records.map((r) => r.code), store.mission().code];
    const destination = environment.destinations?.find((d) => d.id === draft.destination);
    const record = recordFromDraft(
      draft,
      generateUniqueMissionCode(taken),
      environment,
      new Date(),
      destination?.delayMin,
    );
    await save(record);
    await apply(record);
    let registered = false;
    const base = apiBase();
    if (base) {
      try {
        await request(`${base}/api/missions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toApiBody(record, store.mission().crew)),
        });
        registered = true;
      } catch {
        registered = false;
      }
    }
    return { record, registered };
  }

  async function update(code: string, changes: Partial<MissionRecord>) {
    const record = recordFor(code);
    if (!record) return;
    await save({ ...record, ...changes });
  }

  return { records, recordFor, join, chooseCrewMember, addTypedCrewMember, create, update };
}
