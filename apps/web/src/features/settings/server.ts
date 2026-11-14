import 'server-only';
import { connection } from 'next/server';
import { listMissions as queryListMissions } from '@/server/queries';
import type { StoredMission } from '@/server/types';

export async function readMissions(): Promise<StoredMission[] | null> {
  await connection();
  try {
    return (await queryListMissions()).missions;
  } catch {
    return null;
  }
}
