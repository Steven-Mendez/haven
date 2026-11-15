'use server';

import type { I18n, MissionPhase } from '@haven/core';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { setMission } from '@/components/haven/actions';
import { havenTexts } from '@/components/haven/texts';
import type { KpiDashboard } from '@/lib/kpi';
import { getMissionCode } from '@/lib/mission';
import { CREW_NOT_READY } from '@/server/types';
import { formInt } from './logic/exercise';
import { templatePhases } from './logic/plan-options';
import { applyEdit, engineCheck, parseNumber, type RulesEdit, validateEdit } from './logic/rules';
import {
  createMission,
  finishMission,
  getBaseConfig,
  getCrewPlan,
  getCurrentConfig,
  getMission,
  listRules,
  mergeMission,
  saveExercisePrescription,
  saveKpiDashboardFor,
  saveMedicationPlan,
  saveRules,
  saveSampleResult,
  startMission,
  updateMission,
} from './server';
import type {
  ExerciseFormState,
  JoinFormState,
  MedicationFormState,
  MissionField,
  MissionFormState,
  RulesFormState,
  SampleResultFormState,
} from './types';

const text = (v: FormDataEntryValue | null, max = 280) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

export async function sendRulesVersion(
  _previous: RulesFormState,
  form: FormData,
): Promise<RulesFormState> {
  const mission = await getMissionCode();
  const stored = mission ? await getMission(mission) : null;
  if (!mission || !stored) return { status: 'error', errors: [], message: 'mission' };

  const { versions } = await listRules(mission);
  const { config } = await getCurrentConfig(mission, versions);
  const indicatorId = text(form.get('indicator'), 80);
  const indicator = config.indicators.find((i) => i.id === indicatorId);
  const range = (prefix: string): [number, number] => [
    parseNumber(form.get(`${prefix}-min`)) ?? Number.NaN,
    parseNumber(form.get(`${prefix}-max`)) ?? Number.NaN,
  ];
  const edit: RulesEdit = { indicator: indicatorId, green: range('green'), outside: {} };
  indicator?.rules.forEach((r, index) => {
    if (r.outside) edit.outside[index] = range(`rule-${index}`);
  });

  const errors = validateEdit(indicator, edit);
  if (errors.length) return { status: 'error', errors };

  const base = getBaseConfig().version;
  const names = new Set(versions.map((v) => v.version));
  let n = versions.length + 1;
  while (names.has(`${base}-earth.${n}`)) n++;
  const version = `${base}-earth.${n}`;
  const next = applyEdit(config, edit, version);
  if (!engineCheck(next, indicatorId, new Date()).ok)
    return { status: 'error', errors: [{ field: 'green', code: 'engine' }], message: 'engine' };

  const result = await saveRules(mission, {
    config: next as unknown as Record<string, unknown>,
    version,
    note: text(form.get('note'), 500),
    author: havenTexts.es.operatorName,
  });
  if (!result.ok) return { status: 'error', errors: [], message: 'save' };
  refresh();
  return { status: 'ok', version, at: Date.now() };
}

export async function createMissionAction(
  _previous: MissionFormState,
  form: FormData,
): Promise<MissionFormState> {
  const name = text(form.get('name'), 80);
  if (!name) return { status: 'error', fields: ['name'] };
  const phases = templatePhases(text(form.get('template'), 80));
  const result = await createMission({ name, phases, awaitingStart: true });
  if (!result.ok) return { status: 'error', fields: [], message: 'create' };
  await setMission(result.data.code);
  refresh();
  redirect(`/missions/${result.data.code}`);
}

export async function saveMissionPlanAction(
  code: string,
  _previous: MissionFormState,
  form: FormData,
): Promise<MissionFormState> {
  const fields: MissionField[] = [];
  const name = text(form.get('name'), 80);
  if (!name) fields.push('name');

  const known = new Set(getBaseConfig().environments.map((e) => e.id));
  const phases = parsePhases(form.get('phases'), known);
  if (!phases) fields.push('phases');

  const mode = text(form.get('startMode'), 10);
  const startText = mode === 'date' ? text(form.get('start'), 40) : '';
  const start = startText ? new Date(`${startText}T00:00:00Z`) : new Date();
  if (Number.isNaN(start.getTime())) fields.push('start');

  if (fields.length || !phases) return { status: 'error', fields };

  const result = await updateMission(code, {
    name,
    phases,
    start: start.toISOString(),
    awaitingStart: mode !== 'now' && mode !== 'date',
  });
  if (!result.ok) return { status: 'error', fields: [], message: 'create' };
  refresh();
  redirect(`/missions/${code}`);
}

export async function renameMissionAction(
  code: string,
  _previous: { failed: boolean },
  form: FormData,
): Promise<{ failed: boolean }> {
  const name = text(form.get('name'), 80);
  if (!name) return { failed: true };
  const result = await updateMission(code, { name });
  if (!result.ok) return { failed: true };
  refresh();
  return { failed: false };
}

export async function startMissionAction(
  code: string,
): Promise<{ failed: boolean; notReady?: boolean }> {
  const result = await startMission(code);
  if (!result.ok) return { failed: true, notReady: result.error === CREW_NOT_READY };
  refresh();
  return { failed: false };
}

export async function finishMissionAction(code: string): Promise<{ failed: boolean }> {
  const result = await finishMission(code);
  if (!result.ok) return { failed: true };
  refresh();
  return { failed: false };
}

export async function openMissionAt(code: string, path: string) {
  await setMission(code);
  redirect(path.startsWith('/') ? path : '/');
}

function parsePhases(value: FormDataEntryValue | null, known: Set<string>) {
  if (typeof value !== 'string' || value.length > 20_000) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return undefined;
  }
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) return undefined;
  const phases: MissionPhase[] = [];
  for (const p of raw as Record<string, unknown>[]) {
    if (typeof p?.environment !== 'string' || !known.has(p.environment)) return undefined;
    if (typeof p.days !== 'number' || !Number.isInteger(p.days) || p.days < 1) return undefined;
    const label = p.label as I18n | undefined;
    phases.push({
      environment: p.environment,
      days: p.days,
      ...(typeof p.delayMin === 'number' ? { delayMin: p.delayMin } : {}),
      ...(typeof label?.es === 'string' && typeof label?.en === 'string'
        ? { label: { es: label.es, en: label.en } }
        : {}),
    });
  }
  return phases;
}

export async function openMission(code: string) {
  await setMission(code);
  redirect('/');
}

export async function mergeMissionAction(
  from: string,
  into: string,
  _previous: { failed: boolean },
): Promise<{ failed: boolean }> {
  const result = await mergeMission(from, into);
  if (!result.ok) return { failed: true };
  await setMission(into);
  refresh();
  return { failed: false };
}

export async function joinMission(
  _previous: JoinFormState,
  form: FormData,
): Promise<JoinFormState> {
  const value = text(form.get('code'), 12).toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(value)) return { status: 'error', code: 'format', value };
  if (!(await getMission(value))) return { status: 'error', code: 'unknown', value };
  await setMission(value);
  redirect('/');
}

export async function exportRulesConfig(versionId: string): Promise<string | null> {
  const mission = await getMissionCode();
  if (!mission) return null;
  const { versions } = await listRules(mission);
  const version = versions.find((v) => v.id === versionId);
  return version ? `${JSON.stringify(version.config, null, 2)}\n` : null;
}

export async function sendMedicationPlan(
  _previous: MedicationFormState,
  form: FormData,
): Promise<MedicationFormState> {
  const mission = await getMissionCode();
  const crewMember = text(form.get('crewMember'), 60);
  if (!mission || !crewMember) return { status: 'error', crewMember };
  const chosen = form.getAll('medication').map((v) => String(v));
  // The form edits which medications, the end date and the note; a schedule
  // Earth already changed for a medication that stays in the plan is kept.
  const current = await getCrewPlan(mission, crewMember);
  const assignments = chosen.map((id) => {
    const schedule = current.medications.find((a) => a.medication === id)?.schedule;
    return {
      medication: id,
      ...(schedule ? { schedule } : {}),
      until: text(form.get(`until-${id}`), 10) || undefined,
      note: text(form.get(`note-${id}`), 200) || undefined,
    };
  });
  const result = await saveMedicationPlan(
    mission,
    crewMember,
    assignments,
    havenTexts.es.operatorName,
  );
  if (!result.ok) return { status: 'error', crewMember };
  refresh();
  return { status: 'ok', crewMember, at: Date.now() };
}

export async function sendSampleResult(
  _previous: SampleResultFormState,
  form: FormData,
): Promise<SampleResultFormState> {
  const mission = await getMissionCode();
  const id = text(form.get('id'), 200);
  if (!mission || !id) return { status: 'error', id };
  const values: Record<string, number> = {};
  for (const [key, raw] of form.entries()) {
    if (!key.startsWith('value-') || typeof raw !== 'string' || !raw.trim()) continue;
    const value = Number(raw.trim().replace(',', '.'));
    if (Number.isFinite(value)) values[key.slice(6)] = value;
  }
  const result = await saveSampleResult(mission, {
    id,
    values,
    override: text(form.get('override'), 10) || undefined,
    detail: text(form.get('detail'), 280),
    author: havenTexts.es.operatorName,
  });
  if (!result.ok) return { status: 'error', id };
  refresh();
  return { status: 'ok', id, at: Date.now() };
}

export async function saveKpiDashboard(dashboard: KpiDashboard): Promise<{ ok: boolean }> {
  const mission = await getMissionCode();
  if (!mission) return { ok: false };
  try {
    return { ok: (await saveKpiDashboardFor(mission, dashboard)).ok };
  } catch {
    return { ok: false };
  }
}

export async function sendExercisePrescription(
  _previous: ExerciseFormState,
  form: FormData,
): Promise<ExerciseFormState> {
  const mission = await getMissionCode();
  const crewMember = text(form.get('crewMember'), 60);
  if (!mission || !crewMember) return { status: 'error', crewMember };
  // "Reset" clears Earth's change so the starting prescription applies again.
  const prescription =
    form.get('intent') === 'reset'
      ? null
      : {
          resistanceMinutes: formInt(form.get('resistanceMinutes')),
          aerobicMinutes: formInt(form.get('aerobicMinutes')),
          daysPerWeek: formInt(form.get('daysPerWeek')),
          note: text(form.get('note'), 200) || undefined,
        };
  const result = await saveExercisePrescription(
    mission,
    crewMember,
    prescription,
    havenTexts.es.operatorName,
  );
  if (!result.ok) return { status: 'error', crewMember };
  refresh();
  return { status: 'ok', crewMember, at: Date.now() };
}
