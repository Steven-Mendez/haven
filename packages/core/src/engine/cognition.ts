import type { Action, Assessment, Config, I18n, Level, Reading } from '../contracts';
import {
  ACTION_NOTIFY_EARTH,
  ACTION_REPEAT_BATTERY,
  defaultActionCatalog,
  resolveActions,
} from './actions';
import { computeBaseline } from './baseline';
import { evaluate } from './evaluate';
import { BATTERY_INDICATORS } from './routine';
import { MIN_MS, ms, worstLevel } from './util';

export type CognitiveVerdict = {
  /** Current battery level (worst of its indicators); with no battery yet, "pending". */
  level: Level;
  /** Current assessments of the battery indicators. */
  assessments: Assessment[];
  /** End time of the last battery session. */
  takenAt?: string;
  /** Failed batteries in a row, counting the last one (0 if the last one was green). */
  consecutiveFailures: number;
  /** While `now` < `lockedUntil` the battery cannot be repeated (2 h after a failure). */
  lockedUntil?: string;
  canRetake: boolean;
  /** Second failure in a row: a notice to Earth must be queued. */
  notifyEarth: boolean;
  actions: Action[];
  explanation: I18n;
};

export type CognitionOptions = {
  /** Lock minutes after a failure (default 120). */
  lockMin?: number;
  /** Battery readings less than N minutes apart belong to the same session (default 15). */
  sessionGapMin?: number;
  actions?: Action[];
};

type Session = { start: number; end: number };

function sessions(readings: Reading[], now: Date, gapMin: number): Session[] {
  const times = readings
    .filter(
      (r) =>
        (BATTERY_INDICATORS as readonly string[]).includes(r.indicator) &&
        ms(r.takenAt) <= now.getTime(),
    )
    .map((r) => ms(r.takenAt))
    .sort((a, b) => a - b);
  const result: Session[] = [];
  for (const t of times) {
    const last = result.at(-1);
    if (last && t - last.end <= gapMin * MIN_MS) last.end = t;
    else result.push({ start: t, end: t });
  }
  return result;
}

/**
 * Cognitive battery verdict (M10). `evaluate()` decides the level with the config rules (reaction vs.
 * baseline, lapses, memory, attention). A battery "fails" if any of its indicators is amber or red.
 * After a failure the battery is locked for `lockMin` (2 h); two failures in a row add the
 * "notify Earth" action (`notify-earth`). For each past session, any baseline missing from
 * `baseline` is computed from the readings before that session.
 */
export function cognitiveVerdict(
  readings: Reading[],
  config: Config,
  environment: string,
  baseline: Record<string, Assessment['baseline']>,
  now: Date,
  options?: CognitionOptions,
): CognitiveVerdict {
  const catalog = options?.actions ?? defaultActionCatalog();
  const lockMin = options?.lockMin ?? 120;
  const cfg: Config = {
    ...config,
    indicators: config.indicators.filter((i) =>
      (BATTERY_INDICATORS as readonly string[]).includes(i.id),
    ),
  };
  const list = sessions(readings, now, options?.sessionGapMin ?? 15);

  const evaluateAt = (instant: Date, sessionStart?: number) => {
    const baselines: Record<string, Assessment['baseline']> = {};
    for (const id of BATTERY_INDICATORS) {
      baselines[id] =
        baseline[id] ??
        computeBaseline(
          readings,
          id,
          sessionStart !== undefined ? { before: new Date(sessionStart) } : undefined,
        );
    }
    return evaluate(readings, cfg, environment, baselines, [], instant, { actions: catalog });
  };
  const failed = (as: Assessment[]) => as.some((a) => a.level === 'amber' || a.level === 'red');

  const last = list.at(-1);
  const assessments = evaluateAt(now, last?.start);
  if (!last) {
    return {
      level: 'pending',
      assessments,
      consecutiveFailures: 0,
      canRetake: true,
      notifyEarth: false,
      actions: [],
      explanation: {
        es: 'Aún no has hecho la batería cognitiva.',
        en: 'You have not taken the cognitive battery yet.',
      },
    };
  }

  let consecutiveFailures = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i] as Session;
    const as = i === list.length - 1 ? assessments : evaluateAt(new Date(s.end), s.start);
    if (!failed(as)) break;
    consecutiveFailures++;
  }

  const lockEnd = last.end + lockMin * MIN_MS;
  const locked = consecutiveFailures > 0 && lockEnd > now.getTime();
  const notifyEarth = consecutiveFailures >= 2;
  const ids = [
    ...(notifyEarth ? [ACTION_NOTIFY_EARTH] : []),
    ...(consecutiveFailures > 0 ? [ACTION_REPEAT_BATTERY] : []),
    ...assessments.flatMap((a) => a.actions.map((x) => x.id)),
  ];
  const actions = resolveActions(ids, catalog);
  // Keep "notify Earth" even if the catalog gives it a low priority.
  if (notifyEarth && !actions.some((a) => a.id === ACTION_NOTIFY_EARTH)) {
    actions.splice(2, 1, ...resolveActions([ACTION_NOTIFY_EARTH], catalog));
  }

  const explanation: I18n =
    consecutiveFailures === 0
      ? {
          es: 'Batería dentro de tu línea base: en condiciones de trabajar.',
          en: 'Battery within your baseline: fit for duty.',
        }
      : notifyEarth
        ? {
            es: 'Segundo resultado seguido fuera de tu línea base: descansa; se avisa a Tierra.',
            en: 'Second result in a row outside your baseline: rest; Earth will be notified.',
          }
        : {
            es: 'Resultado fuera de tu línea base: descansa y repite la batería en 2 h.',
            en: 'Result outside your baseline: rest and repeat the battery in 2 h.',
          };

  return {
    level: worstLevel(assessments.map((a) => a.level)),
    assessments,
    takenAt: new Date(last.end).toISOString(),
    consecutiveFailures,
    lockedUntil: locked ? new Date(lockEnd).toISOString() : undefined,
    canRetake: !locked,
    notifyEarth,
    actions,
    explanation,
  };
}
