import 'server-only';
import { awaitingResults, type Config, rebaseConfig, type SampleResult } from '@haven/core';
import { connection } from 'next/server';
import { baseConfig } from '@/server/model';
import {
  type MissionEdit,
  missionAggregates as queryAggregates,
  createMission as queryCreateMission,
  finishMission as queryFinishMission,
  getAstronaut as queryGetAstronaut,
  getCrew as queryGetCrew,
  getMission as queryGetMission,
  getPlan as queryGetPlan,
  listMissions as queryListMissions,
  listRules as queryListRules,
  listSampleResults as queryListSampleResults,
  mergeMission as queryMergeMission,
  savePlan as querySavePlan,
  saveRules as querySaveRules,
  saveSampleResult as querySaveSampleResult,
  startMission as queryStartMission,
  updateMission as queryUpdateMission,
} from '@/server/queries';
import type {
  AggregatesResponse,
  ApplyRulesVersion,
  CrewResponse,
  MissionsResponse,
  NewMission,
  NewRulesVersion,
  RulesResponse,
  RulesVersion,
  StoredMission,
} from '@/server/types';
import { DEFAULT_MISSION } from '@/server/types';
import { type EvaRow, evaRow } from './logic/eva';
import { type MedicationRow, medicationRow } from './logic/medication';
import { type ReentryRow, reentryRow } from './logic/reentry';
import { isFullConfig } from './logic/rules';
import { type PendingSample, type SampleRow, sampleRow } from './logic/samples';

export async function listMissions(): Promise<MissionsResponse> {
  await connection();
  return queryListMissions();
}

export async function getMission(code = DEFAULT_MISSION): Promise<StoredMission | null> {
  await connection();
  return queryGetMission(code);
}

export async function createMission(body: NewMission | unknown) {
  await connection();
  return queryCreateMission(body);
}

export async function updateMission(code: string, edit: MissionEdit) {
  await connection();
  return queryUpdateMission(code, edit);
}

export async function startMission(code: string) {
  await connection();
  return queryStartMission(code);
}

export async function finishMission(code: string) {
  await connection();
  return queryFinishMission(code);
}

export async function mergeMission(from: string, into: string) {
  await connection();
  return queryMergeMission(from, into);
}

export async function listRules(mission = DEFAULT_MISSION): Promise<RulesResponse> {
  await connection();
  return queryListRules(mission);
}

export async function downloadRules(mission: string, crewMember?: string): Promise<RulesResponse> {
  await connection();
  return queryListRules(mission, { downloadedBy: crewMember });
}

export async function saveRules(
  mission: string,
  body: NewRulesVersion | ApplyRulesVersion | unknown,
) {
  await connection();
  return querySaveRules(mission, body);
}

export async function getAggregates(
  indicators: string[],
  mission = DEFAULT_MISSION,
): Promise<AggregatesResponse> {
  await connection();
  return queryAggregates(mission, indicators);
}

export function getBaseConfig(): Config {
  return baseConfig();
}

export async function getCurrentConfig(
  mission = DEFAULT_MISSION,
  versions?: RulesVersion[],
): Promise<{ config: Config; fromVersion: RulesVersion | null }> {
  const list = versions ?? (await listRules(mission)).versions;
  const latest = list.find((v) => isFullConfig(v.config)) ?? null;
  return latest
    ? { config: rebaseConfig(baseConfig(), latest.config), fromVersion: latest }
    : { config: baseConfig(), fromVersion: null };
}

export async function getCrewOverview(mission = DEFAULT_MISSION): Promise<CrewResponse | null> {
  await connection();
  return queryGetCrew(mission);
}

export async function getEvaReadiness(
  mission = DEFAULT_MISSION,
): Promise<{ generatedAt: string; rows: EvaRow[] } | null> {
  await connection();
  const crew = await queryGetCrew(mission);
  if (!crew) return null;
  const config = baseConfig();
  const now = new Date(crew.generatedAt);
  const rows = await Promise.all(
    crew.crew.map(async (member) => {
      const detail = await queryGetAstronaut(mission, member.id);
      const readings = detail?.packets.flatMap((p) => p.readings) ?? [];
      return evaRow(member, detail?.assessments ?? [], config, readings, now);
    }),
  );
  return { generatedAt: crew.generatedAt, rows: rows.sort((a, b) => a.name.localeCompare(b.name)) };
}

export async function getReentryReadiness(
  mission = DEFAULT_MISSION,
): Promise<{ generatedAt: string; rows: ReentryRow[] } | null> {
  await connection();
  const crew = await queryGetCrew(mission);
  if (!crew) return null;
  const now = new Date(crew.generatedAt);
  const rows = await Promise.all(
    crew.crew.map(async (member) => {
      const detail = await queryGetAstronaut(mission, member.id);
      const readings = detail?.packets.flatMap((p) => p.readings) ?? [];
      return reentryRow(member, readings, detail?.assessments ?? [], now);
    }),
  );
  return { generatedAt: crew.generatedAt, rows: rows.sort((a, b) => a.name.localeCompare(b.name)) };
}

export async function getMedicationOverview(
  mission = DEFAULT_MISSION,
): Promise<{ generatedAt: string; rows: MedicationRow[] } | null> {
  await connection();
  const crew = await queryGetCrew(mission);
  if (!crew) return null;
  const now = new Date(crew.generatedAt);
  const rows = await Promise.all(
    crew.crew.map(async (member) => {
      const [detail, plan] = await Promise.all([
        queryGetAstronaut(mission, member.id),
        queryGetPlan(mission, member.id),
      ]);
      const readings = detail?.packets.flatMap((p) => p.readings) ?? [];
      return medicationRow(member, plan, readings, now);
    }),
  );
  return { generatedAt: crew.generatedAt, rows: rows.sort((a, b) => a.name.localeCompare(b.name)) };
}

export async function saveMedicationPlan(
  mission: string,
  crewMember: string,
  medications: unknown,
  author?: string,
) {
  await connection();
  return querySavePlan(mission, crewMember, medications, author);
}

export async function getSampleOverview(mission = DEFAULT_MISSION): Promise<{
  generatedAt: string;
  day: number;
  rows: SampleRow[];
  pending: PendingSample[];
  results: SampleResult[];
} | null> {
  await connection();
  const [crew, stored, results] = await Promise.all([
    queryGetCrew(mission),
    queryGetMission(mission),
    queryListSampleResults(mission),
  ]);
  if (!crew || !stored) return null;
  const now = new Date(crew.generatedAt);
  const names = new Map(crew.crew.map((m) => [m.id, m.name]));
  const pending: PendingSample[] = [];
  const rows = await Promise.all(
    crew.crew.map(async (member) => {
      const detail = await queryGetAstronaut(mission, member.id);
      const readings = detail?.packets.flatMap((p) => p.readings) ?? [];
      pending.push(
        ...awaitingResults(readings, results).map((p) => ({
          ...p,
          name: names.get(p.crewMember) ?? p.crewMember,
        })),
      );
      return sampleRow(member, Math.max(1, stored.day), readings, results, now);
    }),
  );
  return {
    generatedAt: crew.generatedAt,
    day: stored.day,
    rows: rows.sort((a, b) => a.name.localeCompare(b.name)),
    pending: pending.sort((a, b) => a.collectedAt.localeCompare(b.collectedAt)),
    results: [...results].reverse(),
  };
}

export async function saveSampleResult(
  mission: string,
  input: { id: string; result: string; detail?: string; author?: string },
) {
  await connection();
  return querySaveSampleResult(mission, input);
}
