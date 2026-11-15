import type { PrebreatheMethod } from '@haven/core';

export const SESSION_COLLECTION = 'eva_sessions';
export const CURRENT_SESSION = 'current';

export type PrebreatheSession = {
  method: string;
  startedAt: string;
  crewMember: string;
  /** Mission the session was started in; older sessions without it are discarded. */
  mission?: string;
};

/** Minimum time after which a session nobody finished is considered abandoned. */
const ABANDONED_AFTER_MIN = 240;

/**
 * A stored session only continues for the same crew member and mission, with a
 * method of the catalog, and while it is not abandoned: past 4 h or twice the
 * method minutes, whichever is longer.
 */
export function sessionUsable(
  session: PrebreatheSession,
  who: { crewMember: string; mission: string },
  method: Pick<PrebreatheMethod, 'minutes'> | undefined,
  now: Date,
): boolean {
  if (!method || session.crewMember !== who.crewMember || session.mission !== who.mission) {
    return false;
  }
  const elapsedMin = (now.getTime() - Date.parse(session.startedAt)) / 60_000;
  return elapsedMin <= Math.max(ABANDONED_AFTER_MIN, method.minutes * 2);
}

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
