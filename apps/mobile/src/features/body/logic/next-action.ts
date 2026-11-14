import type { Config, Level, Zone } from '@haven/core';
import { SEVERITY } from './alerts';

// «Today» card (M01, DESIGN_SYSTEM 4.1a): the next daily action still to do and where it opens.

export type NextAction = {
  zone: Zone;
  /** Where «Measure» goes: an indicator screen with the field focused, or another screen. */
  target: { kind: 'indicator'; id: string } | { kind: 'screen'; id: string };
};

/**
 * First zone whose daily action is below 100 %, worst zone level first (red, amber, pending,
 * green) and config order as tie-break. `undefined` when the day is complete.
 */
export function nextDailyAction(
  progress: { zone: string; progress: number }[],
  zones: { zone: string; level: Level }[],
  config: Config,
): NextAction | undefined {
  const levelOf = (id: string): Level => zones.find((z) => z.zone === id)?.level ?? 'pending';
  const open = config.zones
    .map((zone, order) => ({ zone, order }))
    .filter(({ zone }) => (progress.find((p) => p.zone === zone.id)?.progress ?? 0) < 1)
    .sort(
      (a, b) => SEVERITY[levelOf(b.zone.id)] - SEVERITY[levelOf(a.zone.id)] || a.order - b.order,
    );
  const first = open[0]?.zone;
  if (!first) return undefined;
  const opens = first.dailyAction.opens;
  const isIndicator = config.indicators.some((i) => i.id === opens);
  return {
    zone: first,
    target: isIndicator ? { kind: 'indicator', id: opens } : { kind: 'screen', id: opens },
  };
}

/** Most recent `takenAt` among readings (ISO), for «Latest data n min ago». */
export function latestTakenAt(readings: { takenAt: string }[]): string | undefined {
  let latest: string | undefined;
  for (const r of readings) if (!latest || r.takenAt > latest) latest = r.takenAt;
  return latest;
}
