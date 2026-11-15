import 'server-only';
import {
  awaitingResults,
  type Config,
  rebaseConfig,
  type SampleResult,
  sampleAge,
  sampleConfig,
  sampleContext,
  sampleHistory,
} from '@haven/core';
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
  listSampleResults as queryListSampleResults,
  saveDashboard as querySaveDashboard,
  savePlan as querySavePlan,
  savePrescription as querySavePrescription,
  saveRules as querySaveRules,
  saveSampleResult as querySaveSampleResult,
  startMission as queryStartMission,
  updateMission as queryUpdateMission,
  type SampleResultInput,
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
import { type ExerciseRow, exerciseRow } from './logic/exercise';
import { type MedicationRow, medicationRow } from './logic/medication';
import { type MotionRow, motionRow } from './logic/motion';
import { type ReentryRow, reentryRow } from './logic/reentry';
import { isFullConfig } from './logic/rules';
import { missionDayOf, type PendingSample, type SampleRow, sampleRow } from './logic/samples';
import { type WorkloadRow, workloadRow } from './logic/workload';

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
  const now = new Date(crew.generatedAt);
  const rows = await Promise.all(
    crew.crew.map(async (member) => {
      const detail = await queryGetAstronaut(mission, member.id);
      // Each routine packet repeats the last 24 h: keep every reading once.
      const readings = [
        ...new Map(
          (detail?.packets ?? []).flatMap((p) => p.readings).map((r) => [r.id, r]),
        ).values(),
      ];
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
      // Each routine packet repeats the last 24 h: keep every reading once.
      const readings = [
        ...new Map(
          (detail?.packets ?? []).flatMap((p) => p.readings).map((r) => [r.id, r]),
        ).values(),
      ];
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
      // Each routine packet repeats the last 24 h: keep every reading once.
      const readings = [
        ...new Map(
          (detail?.packets ?? []).flatMap((p) => p.readings).map((r) => [r.id, r]),
        ).values(),
      ];
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
      // Each routine packet repeats the last 24 h: keep every reading once.
      const readings = [
        ...new Map(
          (detail?.packets ?? []).flatMap((p) => p.readings).map((r) => [r.id, r]),
        ).values(),
      ];
      for (const c of awaitingResults(readings, results)) {
        const sample = sampleConfig.samples.find((s) => s.id === c.sample);
        if (!sample) continue;
        pending.push({
          ...c,
          name: names.get(c.crewMember) ?? c.crewMember,
          day: missionDayOf(stored.start, c.collectedAt),
          age: sampleAge(sample, c.collectedAt, now),
          context: sampleContext(sample, readings, c.collectedAt),
          history: sampleHistory(results, c.crewMember, c.sample, c.collectedAt),
        });
      }
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

export async function saveSampleResult(mission: string, input: SampleResultInput) {
  await connection();
  return querySaveSampleResult(mission, input);
}

export async function getCrewPlan(mission: string, crewMember: string) {
  await connection();
  return queryGetPlan(mission, crewMember);
}

export async function getExerciseOverview(
  mission = DEFAULT_MISSION,
): Promise<{ generatedAt: string; rows: ExerciseRow[] } | null> {
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
      // Each routine packet repeats the last 24 h: keep every reading once.
      const readings = [
        ...new Map(
          (detail?.packets ?? []).flatMap((p) => p.readings).map((r) => [r.id, r]),
        ).values(),
      ];
      return exerciseRow(member, plan, readings, now);
    }),
  );
  return { generatedAt: crew.generatedAt, rows: rows.sort((a, b) => a.name.localeCompare(b.name)) };
}

export async function saveExercisePrescription(
  mission: string,
  crewMember: string,
  prescription: unknown,
  author?: string,
) {
  await connection();
  return querySavePrescription(mission, crewMember, prescription, author);
}

export async function getMotionOverview(
  mission = DEFAULT_MISSION,
): Promise<{ generatedAt: string; rows: MotionRow[]; environment: string } | null> {
  await connection();
  const [crew, stored] = await Promise.all([queryGetCrew(mission), queryGetMission(mission)]);
  if (!crew || !stored) return null;
  const now = new Date(crew.generatedAt);
  const { environments } = baseConfig();
  const rows = await Promise.all(
    crew.crew.map(async (member) => {
      const detail = await queryGetAstronaut(mission, member.id);
      // Each routine packet repeats the last 24 h: keep every reading once.
      const readings = [
        ...new Map(
          (detail?.packets ?? []).flatMap((p) => p.readings).map((r) => [r.id, r]),
        ).values(),
      ];
      return motionRow(member, readings, stored, environments, now);
    }),
  );
  return {
    generatedAt: crew.generatedAt,
    environment: stored.environment,
    rows: rows.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function getWorkloadOverview(
  mission = DEFAULT_MISSION,
): Promise<{ generatedAt: string; rows: WorkloadRow[] } | null> {
  await connection();
  const crew = await queryGetCrew(mission);
  if (!crew) return null;
  const now = new Date(crew.generatedAt);
  const rows = await Promise.all(
    crew.crew.map(async (member) => {
      const detail = await queryGetAstronaut(mission, member.id);
      // Each routine packet repeats the last 24 h: keep every reading once.
      const readings = [
        ...new Map(
          (detail?.packets ?? []).flatMap((p) => p.readings).map((r) => [r.id, r]),
        ).values(),
      ];
      return workloadRow(member, readings, now);
    }),
  );
  return { generatedAt: crew.generatedAt, rows: rows.sort((a, b) => a.name.localeCompare(b.name)) };
}
