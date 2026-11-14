import {
  type Config,
  type Reading,
  type Scenario,
  WATCH_CONTRACT_VERSION,
  type WatchEnvelope,
  type WatchMessages,
  type WatchMessageType,
} from '../contracts';
import { CATEGORY_CODES } from '../engine/categories';

import { readingsFromEnvelope } from '../engine/watch-readings';
import { generateSeries, SERIES_BY_INDICATOR, SOURCE_BY_INDICATOR } from './series';

const MIN_MS = 60_000;
const WATCH_TYPES: readonly string[] = ['status', 'mood', 'emergency', 'monitor', 'crewHaptic'];

export type TimelineItem = {
  minute: number;
  reading?: Reading;
  envelope?: WatchEnvelope;
};

export type TimelineOptions = {
  config?: Config;
  fill?: boolean;
};

function isWatchType(message: string): message is WatchMessageType {
  return WATCH_TYPES.includes(message);
}

export function scenarioTimeline(
  scenario: Scenario,
  crewMember: string,
  start: Date,
  options?: TimelineOptions,
): TimelineItem[] {
  const t0 = start.getTime();
  const config = options?.config;
  const at = (minute: number) => new Date(t0 + minute * MIN_MS).toISOString();
  const unitOf = (indicator: string) =>
    config?.indicators.find((i) => i.id === indicator)?.unit ??
    SERIES_BY_INDICATOR[indicator]?.unit ??
    '';
  const makeReading = (
    indicator: string,
    value: number | string,
    minute: number,
    idx: string,
    unit?: string,
  ): Reading => ({
    id: `sim-${scenario.id}-${crewMember}-${indicator}-${idx}-${t0 + minute * MIN_MS}`,
    indicator,
    value,
    unit: unit ?? unitOf(indicator),
    takenAt: at(minute),
    source: indicator === 'symptom' ? 'screen' : (SOURCE_BY_INDICATOR[indicator] ?? 'manual'),
    simulated: false,
    crewMember,
  });

  const items: TimelineItem[] = [];
  const categorical =
    ((scenario as Scenario & { categorical?: unknown }).categorical as
      | { indicator: string; points: [number, string | number][] }[]
      | undefined) ?? [];
  for (const c of categorical) {
    c.points.forEach(([minute, value], i) => {
      items.push({ minute, reading: makeReading(c.indicator, value, minute, `c${i}`) });
    });
  }
  for (const s of scenario.series) {
    const codes = CATEGORY_CODES[s.indicator];
    s.points.forEach(([minute, raw], i) => {
      const value = codes ? (codes[raw] ?? String(raw)) : raw;
      items.push({ minute, reading: makeReading(s.indicator, value, minute, `p${i}`) });
    });
  }

  scenario.events.forEach((e, i) => {
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    if (isWatchType(e.message)) {
      const p: Record<string, unknown> = { ...payload };
      const missing = (k: string) => p[k] === undefined || p[k] === '';
      if (e.message !== 'crewHaptic' && e.message !== 'status' && missing('takenAt')) {
        p.takenAt = at(e.minute);
      }
      if (e.message === 'status' && missing('evaluatedAt')) p.evaluatedAt = at(e.minute);
      if (e.message === 'monitor' && p.spo2 !== undefined && missing('spo2TakenAt')) {
        p.spo2TakenAt = at(e.minute);
      }
      items.push({
        minute: e.minute,
        envelope: {
          v: WATCH_CONTRACT_VERSION,
          type: e.message,
          crewMember,
          simulated: false,
          sentAt: at(e.minute),
          payload: p as WatchMessages[typeof e.message],
        },
      });
    } else if (e.message === 'symptom' && payload.value !== undefined) {
      items.push({
        minute: e.minute,
        reading: makeReading('symptom', String(payload.value), e.minute, `e${i}`, ''),
      });
    } else if (e.message === 'reading' && typeof payload.indicator === 'string') {
      const value = payload.value as number | string;
      items.push({
        minute: e.minute,
        reading: makeReading(
          payload.indicator,
          value,
          e.minute,
          `e${i}`,
          typeof payload.unit === 'string' ? payload.unit : undefined,
        ),
      });
    }
  });

  if (options?.fill ?? true) {
    const scripted = new Set(items.flatMap((x) => (x.reading ? [x.reading.indicator] : [])));
    const ids = config ? config.indicators.map((i) => i.id) : Object.keys(SERIES_BY_INDICATOR);
    const end = t0 + scenario.durationMin * MIN_MS;
    for (const id of ids) {
      if (scripted.has(id)) continue;
      for (const reading of generateSeries(crewMember, id, t0, end, { config, anchor: t0 })) {
        items.push({ minute: (new Date(reading.takenAt).getTime() - t0) / MIN_MS, reading });
      }
    }
  }

  return items.sort((a, b) => a.minute - b.minute);
}

export function scenarioReadings(
  scenario: Scenario,
  crewMember: string,
  start: Date,
  options?: TimelineOptions,
): Reading[] {
  return scenarioTimeline(scenario, crewMember, start, options).flatMap((x) => [
    ...(x.reading ? [x.reading] : []),
    ...(x.envelope ? readingsFromEnvelope(x.envelope) : []),
  ]);
}
