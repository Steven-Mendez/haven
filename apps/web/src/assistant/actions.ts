'use server';

import { setMission } from '@/components/haven/actions';
import { getMission } from '@/features/extras/server';

/** Switches the operator's active mission, if it exists. Orion's switchMission ends here. */
export async function activateMission(
  code: string,
): Promise<{ ok: true; code: string; name: string } | { ok: false }> {
  const value = String(code).toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(value)) return { ok: false };
  const mission = await getMission(value).catch(() => null);
  if (!mission) return { ok: false };
  await setMission(value);
  return { ok: true, code: value, name: mission.name };
}
