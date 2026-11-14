import type { Assessment, Config, Indicator, Level, Zone } from '@haven/core';

export type ZoneIndicator = {
  indicator: Indicator;
  assessment: Assessment | undefined;
  level: Level;
};

export type ZoneDetail = {
  zone: Zone;
  level: Level;
  indicators: ZoneIndicator[];
};

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

export function toggleZone(current: string | undefined, tapped: string): string | undefined {
  return current === tapped ? undefined : tapped;
}
