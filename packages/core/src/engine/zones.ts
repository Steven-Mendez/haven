import type { Assessment, Config, Level } from '../contracts';
import { worstLevel } from './util';

export type ZoneAssessment = { zone: string; level: Level; assessments: Assessment[] };

export function zoneIndicatorIds(config: Config, zoneId: string): Set<string> {
  const zone = config.zones.find((z) => z.id === zoneId);
  return new Set([
    ...(zone?.indicators ?? []),
    ...config.indicators.filter((i) => i.zone === zoneId).map((i) => i.id),
  ]);
}

export function evaluateZones(assessments: Assessment[], config: Config): ZoneAssessment[] {
  return config.zones.map((zone) => {
    const ids = zoneIndicatorIds(config, zone.id);
    const own = assessments.filter((a) => ids.has(a.indicator));
    return { zone: zone.id, level: worstLevel(own.map((a) => a.level)), assessments: own };
  });
}

export function overallLevel(assessments: Assessment[]): Level {
  return worstLevel(assessments.map((a) => a.level));
}
