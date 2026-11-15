import 'server-only';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { cache } from 'react';
import { listMissions } from '@/server/queries';

export const MISSION_COOKIE = 'haven-mission';

const CODE = /^[A-Z0-9]{6}$/;

export const getMissionCode = cache(async (): Promise<string | null> => {
  const value = (await cookies()).get(MISSION_COOKIE)?.value?.toUpperCase();
  const chosen = value && CODE.test(value) ? value : null;
  await connection();
  let list: { code: string }[];
  try {
    list = (await listMissions()).missions;
  } catch {
    return chosen;
  }
  if (chosen && list.some((m) => m.code === chosen)) return chosen;
  return list[0]?.code ?? null;
});
