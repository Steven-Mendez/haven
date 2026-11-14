import type { Config, Reading, ReadingSource } from '@haven/core';

export type ZoneOrigin = {
  zone: string;
  sources: ReadingSource[];
  missing: string[];
};

export function zoneOrigins(
  config: Config,
  latest: (indicator: string) => Reading | undefined,
): ZoneOrigin[] {
  return config.zones.map((zone) => {
    const sources: ReadingSource[] = [];
    const missing: string[] = [];
    for (const id of zone.indicators) {
      const reading = latest(id);
      if (!reading) {
        missing.push(id);
        continue;
      }
      if (!sources.includes(reading.source)) sources.push(reading.source);
    }
    return { zone: zone.id, sources, missing };
  });
}
