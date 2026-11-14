import 'server-only';
import type { Config } from '@haven/core';
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
  listMissions as queryListMissions,
  listRules as queryListRules,
  mergeMission as queryMergeMission,
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
import { isFullConfig } from './logic/rules';

// T03 · Server data access for Earth extras (missions, versioned rules, crew aggregates).
// Mutations return `{ ok, status, data }` or `{ ok: false, status, error, details }`.

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

/** Edits a mission within what its status allows (name until finished; plan and start in preparation). */
export async function updateMission(code: string, edit: MissionEdit) {
  await connection();
  return queryUpdateMission(code, edit);
}

/** «Start mission»: day 1 is today. */
export async function startMission(code: string) {
  await connection();
  return queryStartMission(code);
}

/** «Finish mission»: it stays as a record. */
export async function finishMission(code: string) {
  await connection();
  return queryFinishMission(code);
}

/** Folds a mission created by packets with an unknown code into the right one (packets and crew). */
export async function mergeMission(from: string, into: string) {
  await connection();
  return queryMergeMission(from, into);
}

/** Rule versions with delivery status (sent → received → applied). Reading here never marks them received. */
export async function listRules(mission = DEFAULT_MISSION): Promise<RulesResponse> {
  await connection();
  return queryListRules(mission);
}

/** A phone downloads the rules (GET /api/rules): marks every version received by `crewMember` when it
 * belongs to the mission crew; otherwise it only reads. */
export async function downloadRules(mission: string, crewMember?: string): Promise<RulesResponse> {
  await connection();
  return queryListRules(mission, { downloadedBy: crewMember });
}

/** Creates a rules version (`NewRulesVersion`) or marks one as applied (`ApplyRulesVersion`). */
export async function saveRules(
  mission: string,
  body: NewRulesVersion | ApplyRulesVersion | unknown,
) {
  await connection();
  return querySaveRules(mission, body);
}

/** Crew aggregates per indicator, with any crew size; `null` when nobody measured it. */
export async function getAggregates(
  indicators: string[],
  mission = DEFAULT_MISSION,
): Promise<AggregatesResponse> {
  await connection();
  return queryAggregates(mission, indicators);
}

// ─── Added by Spica (T03 view) ────────────────────────────────────────────────

/** Bundled config (the one every phone starts with). */
export function getBaseConfig(): Config {
  return baseConfig();
}

/**
 * The config the next version starts from: the latest version sent to the mission that carries a full
 * config (partial ones are ignored), or the bundled base config.
 */
export async function getCurrentConfig(
  mission = DEFAULT_MISSION,
  versions?: RulesVersion[],
): Promise<{ config: Config; fromVersion: RulesVersion | null }> {
  const list = versions ?? (await listRules(mission)).versions;
  const latest = list.find((v) => isFullConfig(v.config)) ?? null;
  return latest
    ? { config: latest.config as unknown as Config, fromVersion: latest }
    : { config: baseConfig(), fromVersion: null };
}

/** Crew of the mission (visible data only), or `null` when the mission does not exist. */
export async function getCrewOverview(mission = DEFAULT_MISSION): Promise<CrewResponse | null> {
  await connection();
  return queryGetCrew(mission);
}

/**
 * EVA readiness per astronaut from the assessments of their latest visible packet (no private data,
 * nothing logged). `null` when the mission does not exist.
 */
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
