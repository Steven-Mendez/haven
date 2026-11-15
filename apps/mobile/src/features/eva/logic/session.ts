import type { PrebreatheMethod } from '@haven/core';

export const SESSION_COLLECTION = 'eva_sessions';
export const CURRENT_SESSION = 'current';

export type PrebreatheSession = { method: string; startedAt: string; crewMember: string };

export function sessionProgress(
  session: Pick<PrebreatheSession, 'startedAt'>,
  method: Pick<PrebreatheMethod, 'minutes'>,
  now: Date,
): { elapsedSec: number; remainingSec: number; totalSec: number; complete: boolean } {
  const totalSec = method.minutes * 60;
  const elapsedSec = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(session.startedAt)) / 1000),
  );
  const remainingSec = Math.max(0, totalSec - elapsedSec);
  return { elapsedSec, remainingSec, totalSec, complete: remainingSec === 0 };
}
