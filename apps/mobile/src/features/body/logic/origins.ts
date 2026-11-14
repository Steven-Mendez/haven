import type { Config, Reading, ReadingSource } from '@haven/core';

// «Where does this data come from?» (M01): per zone, which sources fed its latest readings.

export type ZoneOrigin = {
  zone: string;
  /** Distinct sources of the latest reading of each indicator, in first-seen order. */
  sources: ReadingSource[];
  /** Indicators of the zone without any reading. */
  missing: string[];
};

/** `latest` maps indicator id → its latest reading (or undefined). */
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
