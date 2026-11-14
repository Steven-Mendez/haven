import type { Assessment, Config, Indicator, Level, Zone } from '@haven/core';

// Inline zone detail (M01): the zone purpose and its indicators with their assessment.

export type ZoneIndicator = {
  indicator: Indicator;
  /** Missing when the engine did not evaluate this indicator: shown as pending. */
  assessment: Assessment | undefined;
  level: Level;
};

export type ZoneDetail = {
  zone: Zone;
  level: Level;
  indicators: ZoneIndicator[];
};

/**
 * Detail of one zone: the indicators listed in `Zone.indicators` (config order) plus any indicator
 * whose `zone` points here but the zone list forgot. The zone level comes from `evaluateZones`.
 */
export function zoneDetail(
  zoneId: string,
  zones: { zone: string; level: Level }[],
  assessments: Assessment[],
  config: Config,
): ZoneDetail | undefined {
  const zone = config.zones.find((z) => z.id === zoneId);
  if (!zone) return undefined;
  const ids = [
    ...zone.indicators,
    ...config.indicators
      .filter((i) => i.zone === zoneId && !zone.indicators.includes(i.id))
      .map((i) => i.id),
  ];
  const indicators: ZoneIndicator[] = [];
  for (const id of ids) {
    const indicator = config.indicators.find((i) => i.id === id);
    if (!indicator) continue;
    const assessment = assessments.find((a) => a.indicator === id);
    indicators.push({ indicator, assessment, level: assessment?.level ?? 'pending' });
  }
  return {
    zone,
    level: zones.find((z) => z.zone === zoneId)?.level ?? 'pending',
    indicators,
  };
}

/** Tapping the selected zone again closes its detail. */
export function toggleZone(current: string | undefined, tapped: string): string | undefined {
  return current === tapped ? undefined : tapped;
}
