import type { Config, Level, Zone } from '@haven/core';
import { SEVERITY } from './alerts';

export type NextAction = {
  zone: Zone;
  target: { kind: 'indicator'; id: string } | { kind: 'screen'; id: string };
};

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

export function latestTakenAt(readings: { takenAt: string }[]): string | undefined {
  let latest: string | undefined;
  for (const r of readings) if (!latest || r.takenAt > latest) latest = r.takenAt;
  return latest;
}
