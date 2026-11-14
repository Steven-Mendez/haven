import 'server-only';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { cache } from 'react';
import { listMissions } from '@/server/queries';

// Active mission (server only). Set by the mission switcher in the sidebar. Request-time API: call inside
// <Suspense>, like getLanguage().

export const MISSION_COOKIE = 'haven-mission';

const CODE = /^[A-Z0-9]{6}$/;

/**
 * The mission the operator is looking at: the cookie's when it still exists, otherwise the most recently
 * created one, and `null` when there is none yet (first run: the pages invite to create the first mission).
 * A mission that only exists because packets arrived with an unknown code (`origin: 'packet'`, usually a typo
 * on a phone) is never picked on its own: the operator opens it from Missions.
 * If the database can't be read, the cookie is trusted so a hiccup never hides the mission.
 */
export const getMissionCode = cache(async (): Promise<string | null> => {
  const value = (await cookies()).get(MISSION_COOKIE)?.value?.toUpperCase();
  const chosen = value && CODE.test(value) ? value : null;
  // Reads the database (dates included): request-time only.
  await connection();
  let list: { code: string; origin: string }[];
  try {
    list = (await listMissions()).missions;
  } catch {
    return chosen;
  }
  if (chosen && list.some((m) => m.code === chosen)) return chosen;
  return (list.find((m) => m.origin !== 'packet') ?? list[0])?.code ?? null;
});
