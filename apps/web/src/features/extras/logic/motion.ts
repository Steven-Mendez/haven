import {
  type AdaptationWindow,
  adaptationWindow,
  type BalanceResult,
  balanceAvailable,
  type Environment,
  latestBalance,
  latestMotion,
  type MissionPhase,
  type MotionEntry,
  motion,
  motionCheckDue,
  motionDays,
  type Reading,
} from '@haven/core';

/** A score older than this no longer describes how the crew member feels. */
const RECENT_MS = 48 * 3_600_000;

export type MotionRow = {
  id: string;
  name: string;
  lastDataAt: string | null;
  noRecentData: boolean;
  /** Latest score of the last 48 h. */
  latest?: MotionEntry;
  days: { day: string; score: number | null }[];
  window: AdaptationWindow;
  /** Window open and no score yet today. */
  checkDue: boolean;
  /** The crew member is on a surface, where the balance test makes sense. */
  surface: boolean;
  balance?: BalanceResult & { at: string };
};

export function motionRow(
  member: { id: string; name: string; lastDataAt: string | null; noRecentData: boolean },
  readings: Reading[],
  mission: { day: number; environment: string; phases?: MissionPhase[] },
  environments: Pick<Environment, 'id' | 'gravity'>[],
  now: Date,
): MotionRow {
  const window = adaptationWindow(mission, motion, environments);
  const latest = latestMotion(readings, motion);
  const balance = latestBalance(readings, motion);
  return {
    ...member,
    ...(latest && now.getTime() - Date.parse(latest.at) <= RECENT_MS ? { latest } : {}),
    days: motionDays(readings, now),
    window,
    checkDue: motionCheckDue(readings, window, now),
    surface: balanceAvailable(mission.environment, environments),
    ...(balance ? { balance } : {}),
  };
}
