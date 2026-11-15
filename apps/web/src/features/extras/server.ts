import 'server-only';
import { type Config, rebaseConfig } from '@haven/core';
import { connection } from 'next/server';
import type { KpiDashboard, KpiSeriesData } from '@/lib/kpi';
import { baseConfig } from '@/server/model';
import {
  type MissionEdit,
  missionAggregates as queryAggregates,
  createMission as queryCreateMission,
  finishMission as queryFinishMission,
  getAstronaut as queryGetAstronaut,
  getCrew as queryGetCrew,
  getDashboard as queryGetDashboard,
  getMission as queryGetMission,
  getPlan as queryGetPlan,
  missionKpiSeries as queryKpiSeries,
  listMissions as queryListMissions,
  listRules as queryListRules,
  mergeMission as queryMergeMission,
  saveDashboard as querySaveDashboard,
  savePlan as querySavePlan,
  saveRules as querySaveRules,
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
import { isFullConfig } from './logic/rules';

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

export async function getKpiSeries(
  indicators: string[],
  mission = DEFAULT_MISSION,
): Promise<KpiSeriesData> {
  await connection();
  return queryKpiSeries(mission, indicators);
}

export async function getKpiDashboard(mission = DEFAULT_MISSION): Promise<KpiDashboard | null> {
  await connection();
  return queryGetDashboard(mission);
}

export async function saveKpiDashboardFor(mission: string, body: unknown) {
  await connection();
  return querySaveDashboard(mission, body);
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
  const rows = await Promise.all(
    crew.crew.map(async (member) => {
      const detail = await queryGetAstronaut(mission, member.id);
      return evaRow(member, detail?.assessments ?? [], config);
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

export async function getCrewPlan(mission: string, crewMember: string) {
  await connection();
  return queryGetPlan(mission, crewMember);
}
