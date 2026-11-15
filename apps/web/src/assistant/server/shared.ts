import 'server-only';
import { getMission } from '@/features/extras/server';
import type { Language } from '@/lib/i18n';
import type { StoredMission } from '@/server/types';

export type Fail = { ok: false; error: string };
export const fail = (error: string): Fail => ({ ok: false, error });

export const NO_MISSION =
  'There is no active mission selected in the console. Tell the operator; they can pick one in the sidebar, or you can offer switchMission or createMission.';

/** Picks the text in the operator's language. */
export const pick = (lang: Language) => (es: string, en: string) => (lang === 'es' ? es : en);

export async function findMission(
  code: string | null | undefined,
): Promise<{ ok: true; mission: StoredMission } | Fail> {
  if (!code) return fail(NO_MISSION);
  const mission = await getMission(code.toUpperCase());
  return mission
    ? { ok: true, mission }
    : fail(`Mission ${code.toUpperCase()} does not exist. Call listMissions for the valid codes.`);
}

/** A crew member by id or by name (the model sometimes has only the name the operator typed). */
export function findCrew(mission: StoredMission, ref: string) {
  const wanted = ref.trim().toLowerCase();
  const member =
    mission.crew.find((m) => m.id === wanted) ??
    mission.crew.find((m) => m.name.trim().toLowerCase() === wanted);
  return member
    ? ({ ok: true, member } as const)
    : fail(
        `"${ref}" is not in mission ${mission.code}. Crew: ${
          mission.crew.map((m) => `${m.name} (${m.id})`).join(', ') || 'nobody yet'
        }.`,
      );
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
