import type { Environment, Level, MissionPhase, MotionConfig, Reading } from '../contracts';
import { DAY_MS, ms, numeric } from './util';

/** Reading of the 0–10 motion sickness scale (MISC). */
export const MOTION_INDICATOR = 'motion-sickness';
/** Reading of the balance test; its value is the sway with eyes closed, in mg. */
export const BALANCE_INDICATOR = 'balance-test';

type Gravity = Pick<Environment, 'id' | 'gravity'>;

export type MotionEntry = { score: number; at: string; level: Level };

export type AdaptationWindow =
  | { open: false }
  | {
      open: true;
      /** launch: first days of the mission; transition: a phase with a different gravity. */
      reason: 'launch' | 'transition';
      environment: string;
      /** 1 on the day of the change. */
      day: number;
      of: number;
    };

export type BalanceResult = { open: number; closed: number; ratio: number; level: Level };

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

export function motionLevel(score: number, cfg: MotionConfig): Level {
  if (score >= cfg.levels.red) return 'red';
  if (score >= cfg.levels.amber) return 'amber';
  return 'green';
}

function scores(readings: Reading[]) {
  return readings
    .filter((r) => r.indicator === MOTION_INDICATOR)
    .map((r) => ({ score: numeric(r), at: r.takenAt }))
    .filter((r): r is { score: number; at: string } => r.score !== undefined)
    .sort((a, b) => ms(a.at) - ms(b.at));
}

export function latestMotion(readings: Reading[], cfg: MotionConfig): MotionEntry | undefined {
  const last = scores(readings).at(-1);
  return last ? { ...last, level: motionLevel(last.score, cfg) } : undefined;
}

/** Worst score of each of the last `days` mission days (UTC), oldest first; null without one. */
export function motionDays(
  readings: Reading[],
  now: Date,
  days = 7,
): { day: string; score: number | null }[] {
  const all = scores(readings);
  const out: { day: string; score: number | null }[] = [];
  for (let k = days - 1; k >= 0; k--) {
    const day = dayOf(now.getTime() - k * DAY_MS);
    const of = all.filter((s) => s.at.slice(0, 10) === day).map((s) => s.score);
    out.push({ day, score: of.length ? Math.max(...of) : null });
  }
  return out;
}

const gravityOf = (environments: Gravity[], id: string | undefined) =>
  environments.find((e) => e.id === id)?.gravity;

/**
 * Whether the crew member is adapting to a new gravity: the first days of the
 * mission, or of a phase whose gravity differs from the one before it.
 */
export function adaptationWindow(
  mission: { day: number; environment: string; phases?: MissionPhase[] },
  cfg: MotionConfig,
  environments: Gravity[],
): AdaptationWindow {
  const of = cfg.windowDays;
  let start = 1;
  let previous: string | undefined;
  for (const phase of mission.phases ?? []) {
    const end = start + Math.max(1, phase.days) - 1;
    if (mission.day <= end) {
      const changed =
        previous !== undefined &&
        gravityOf(environments, previous) !== gravityOf(environments, phase.environment);
      const day = mission.day - start + 1;
      if (changed && day <= of) {
        return { open: true, reason: 'transition', environment: phase.environment, day, of };
      }
      break;
    }
    previous = phase.environment;
    start = end + 1;
  }
  if (mission.day >= 1 && mission.day <= of) {
    return { open: true, reason: 'launch', environment: mission.environment, day: mission.day, of };
  }
  return { open: false };
}

/** The daily check is due while the window is open and today has no score yet. */
export function motionCheckDue(readings: Reading[], window: AdaptationWindow, now: Date): boolean {
  if (!window.open) return false;
  const today = dayOf(now.getTime());
  return !scores(readings).some((s) => s.at.slice(0, 10) === today);
}

/** The balance test needs gravity: on a surface, not in orbit or transit. */
export function balanceAvailable(environment: string, environments: Gravity[]): boolean {
  const g = gravityOf(environments, environment);
  return g !== undefined && g > 0 && g < 2;
}

/**
 * Body sway from accelerometer samples in g: the RMS distance of each sample
 * from the mean acceleration (which is gravity), in milli-g.
 */
export function swayMilliG(samples: { x: number; y: number; z: number }[]): number | undefined {
  if (samples.length < 10) return undefined;
  const n = samples.length;
  const mean = samples.reduce(
    (m, s) => ({ x: m.x + s.x / n, y: m.y + s.y / n, z: m.z + s.z / n }),
    {
      x: 0,
      y: 0,
      z: 0,
    },
  );
  const sq = samples.reduce(
    (sum, s) => sum + (s.x - mean.x) ** 2 + (s.y - mean.y) ** 2 + (s.z - mean.z) ** 2,
    0,
  );
  return Math.round(Math.sqrt(sq / n) * 10_000) / 10;
}

export function balanceResult(
  sway: { open: number; closed: number },
  cfg: MotionConfig,
): BalanceResult {
  const ratio = sway.open > 0 ? Math.round((sway.closed / sway.open) * 10) / 10 : 1;
  const b = cfg.balance;
  const level: Level =
    sway.closed >= b.redSway
      ? 'red'
      : sway.closed >= b.amberSway || ratio >= b.amberRatio
        ? 'amber'
        : 'green';
  return { open: sway.open, closed: sway.closed, ratio, level };
}

export function latestBalance(
  readings: Reading[],
  cfg: MotionConfig,
): (BalanceResult & { at: string }) | undefined {
  const last = readings
    .filter((r) => r.indicator === BALANCE_INDICATOR)
    .sort((a, b) => ms(b.takenAt) - ms(a.takenAt))[0];
  const closed = last ? numeric(last) : undefined;
  if (!last || closed === undefined) return undefined;
  const open = Number(/(?:^|;)open=([\d.]+)/.exec(last.note ?? '')?.[1]);
  return {
    ...balanceResult({ open: Number.isFinite(open) ? open : closed, closed }, cfg),
    at: last.takenAt,
  };
}

type ReadingOptions = { crewMember: string; takenAt: string; newId: () => string };

export function motionReading(score: number, options: ReadingOptions): Reading {
  return {
    id: options.newId(),
    indicator: MOTION_INDICATOR,
    value: score,
    unit: '',
    takenAt: options.takenAt,
    source: 'manual',
    simulated: false,
    crewMember: options.crewMember,
  };
}

export function balanceReading(
  sway: { open: number; closed: number },
  options: ReadingOptions,
): Reading {
  return {
    id: options.newId(),
    indicator: BALANCE_INDICATOR,
    value: sway.closed,
    unit: 'mg',
    takenAt: options.takenAt,
    source: 'screen',
    simulated: false,
    crewMember: options.crewMember,
    note: `open=${sway.open};closed=${sway.closed}`,
  };
}
