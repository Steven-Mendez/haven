import {
  type Assessment,
  categoryLabel,
  type LoadedConfig,
  loadConfig,
  type Reading,
  unitLabel,
} from '@haven/core';
import { ZONE_ORDER } from '@/components/haven';
import type { Language } from '@/lib/i18n';
import { translate } from '@/lib/i18n';
import type { AstronautResponse, ReceivedPacket } from '@/server/types';

// T02 · Pure presentation helpers for the astronaut detail. No data access, no clock: `now` comes in.

/** Indicators read by the on-board monitor (watch or sensor) during an emergency. */
export const MONITOR_INDICATORS = [
  'heart-rate',
  'spo2',
  'heart-rhythm',
  'systolic-bp',
  'diastolic-bp',
] as const;

/** Daily counts drawn as bars (chart spec «Bars»). */
export const BAR_INDICATORS = [
  'steps',
  'distance',
  'floors',
  'sleep',
  'food-intake',
  'resistance-exercise',
] as const;

/** Diary entries travel as readings of this indicator. */
export const DIARY_INDICATOR = 'diary';

/** Notes listed at once; older ones are summarised. */
export const NOTE_ENTRIES_SHOWN = 20;

/** Packets per tab in «Received packets»; older ones are summarised. */
export const PACKETS_PER_TAB = 12;

export type IndicatorInfo = {
  id: string;
  name: string;
  unit: string;
  zone: string;
  kind: 'number' | 'category';
  green: [number, number];
  /** Category value → label via `categoryLabel` from @haven/core (`sinus` → «Sinusal»). */
  label: (value: string) => string;
};

export type Names = {
  environmentName?: string;
  zones: Record<string, { name: string; purpose: string }>;
  indicators: Record<string, IndicatorInfo>;
  protocols: Record<string, { name: string; steps: number }>;
};

let cached: LoadedConfig | undefined;
const config = () => {
  cached ??= loadConfig();
  return cached;
};

/** Display names, units and normal ranges from the config, translated. */
export function namesFor(environment: string, lang: Language): Names {
  const c = config();
  const env = c.environments.find((e) => e.id === environment);
  return {
    environmentName: env ? translate(env.name, lang) : undefined,
    zones: Object.fromEntries(
      c.zones.map((z) => [
        z.id,
        { name: translate(z.name, lang), purpose: translate(z.purpose, lang) },
      ]),
    ),
    indicators: Object.fromEntries(
      c.indicators.map((i) => {
        const override = i.environmentOverrides?.[environment]?.green;
        return [
          i.id,
          {
            id: i.id,
            name: translate(i.name, lang),
            unit: displayUnit(i.unit, lang),
            zone: i.zone,
            kind: i.kind,
            green: override ?? i.green,
            label: (value: string) => categoryLabel(i, value, lang),
          },
        ];
      }),
    ),
    protocols: Object.fromEntries(
      c.protocols.map((p) => [p.id, { name: translate(p.name, lang), steps: p.steps.length }]),
    ),
  };
}

/** Indicator id → translated name, for components that only need the name. */
export function indicatorNameMap(names: Names): Record<string, string> {
  return Object.fromEntries(Object.values(names.indicators).map((i) => [i.id, i.name]));
}

/** Packets newest first by creation time on the server clock (what the API already does). */
export function byNewest(packets: ReceivedPacket[]): ReceivedPacket[] {
  return [...packets].sort((a, b) => Date.parse(b.dataAt) - Date.parse(a.dataAt));
}

/** The packet whose assessments the API returned (latest visible one with assessments). */
export function assessedPacket(data: AstronautResponse): ReceivedPacket | undefined {
  return byNewest(data.packets).find((p) => p.assessments.length > 0);
}

/** Latest visible emergency packet, if any. */
export function latestEmergency(data: AstronautResponse): ReceivedPacket | undefined {
  return byNewest(data.packets).find((p) => p.type === 'emergency');
}

export type ZoneGroup = { zone: string; assessments: Assessment[] };

/** Assessments grouped by zone in the canonical order; unknown zones go last. */
export function groupByZone(assessments: Assessment[], names: Names): ZoneGroup[] {
  const groups = new Map<string, Assessment[]>();
  for (const a of assessments) {
    const zone = names.indicators[a.indicator]?.zone ?? 'other';
    groups.set(zone, [...(groups.get(zone) ?? []), a]);
  }
  const order = (zone: string) => {
    const i = (ZONE_ORDER as readonly string[]).indexOf(zone);
    return i === -1 ? ZONE_ORDER.length : i;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => order(a) - order(b))
    .map(([zone, list]) => ({ zone, assessments: list }));
}

/** Decimals that make a series readable (0 for integers, up to 2). */
export function decimalsFor(values: number[]): number {
  let decimals = 0;
  for (const v of values) {
    const text = String(v);
    const dot = text.indexOf('.');
    if (dot !== -1) decimals = Math.max(decimals, Math.min(2, text.length - dot - 1));
  }
  return decimals;
}

/**
 * Whether the reference range is worth drawing on the chart: a degenerate range ([0, 0]) or one far wider
 * than the data (steps 0–100 000) would flatten the line. It is then given as text instead.
 */
export function drawableRange(green: [number, number], values: number[]): boolean {
  if (green[1] <= green[0] || values.length === 0) return false;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const scale = hi - lo + Math.abs((lo + hi) / 2) * 0.1 || 1;
  return green[1] - green[0] <= scale * 4;
}

/** Protocol ids the engine prompted (actions with `protocol`), most urgent first. */
export function promptedProtocols(assessments: Assessment[]): string[] {
  const ids = assessments
    .filter((a) => a.level === 'red' || a.level === 'amber')
    .flatMap((a) => a.actions)
    .sort((a, b) => a.priority - b.priority)
    .map((a) => a.protocol)
    .filter((p): p is string => Boolean(p));
  return [...new Set(ids)];
}

/** Symptom ids reported in a packet. */
export function symptomsOf(packet: ReceivedPacket): string[] {
  return [
    ...new Set(
      packet.readings.filter((r) => r.indicator === 'symptom').map((r) => String(r.value)),
    ),
  ];
}

/** Monitor readings of a packet in time order. */
export function monitorReadings(packet: ReceivedPacket): Reading[] {
  return packet.readings
    .filter((r) => (MONITOR_INDICATORS as readonly string[]).includes(r.indicator))
    .sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));
}

export type NoteEntry = {
  id: string;
  packetId: string;
  packetType: ReceivedPacket['type'];
  at: string;
  kind: 'notes' | 'diary' | 'readingNote' | 'photoNote';
  text: string;
};

/**
 * Notes, diary entries and reading/photo notes, newest first. Notes on spacecraft telemetry (`source: 'ship'`,
 * e.g. the module a sensor sits in) are metadata, not something the astronaut wrote, and are skipped. */
export function noteEntries(packets: ReceivedPacket[]): NoteEntry[] {
  const entries: NoteEntry[] = [];
  for (const p of packets) {
    const base = { packetId: p.id, packetType: p.type };
    if (p.notes.trim()) {
      entries.push({ ...base, id: `${p.id}:notes`, at: p.dataAt, kind: 'notes', text: p.notes });
    }
    for (const r of p.readings) {
      if (r.indicator === DIARY_INDICATOR) {
        entries.push({
          ...base,
          id: `${p.id}:${r.id}`,
          at: r.takenAt,
          kind: 'diary',
          text: String(r.value),
        });
      } else if (r.note && r.source !== 'ship') {
        entries.push({
          ...base,
          id: `${p.id}:${r.id}:note`,
          at: r.takenAt,
          kind: 'readingNote',
          text: r.note,
        });
      }
    }
    for (const f of p.photos ?? []) {
      if (f.note) {
        entries.push({
          ...base,
          id: `${p.id}:${f.uri}`,
          at: f.takenAt,
          kind: 'photoNote',
          text: f.note,
        });
      }
    }
  }
  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Minutes since each assessment's reading: packet age on the server clock + the engine's `ageMin`. */
export function ageOf(
  a: Assessment,
  assessedAt: string | undefined,
  now: string,
): number | undefined {
  if (!assessedAt) return undefined;
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(assessedAt)) / 60_000)) + a.ageMin;
}

/** Actions of every flagged assessment, deduplicated, most urgent first (one block, not per indicator). */
export function groupedActions(assessments: Assessment[]): Assessment['actions'] {
  const seen = new Map<string, Assessment['actions'][number]>();
  for (const a of assessments) {
    if (a.level !== 'red' && a.level !== 'amber') continue;
    for (const action of a.actions) {
      const prev = seen.get(action.id);
      if (!prev || action.priority < prev.priority) seen.set(action.id, action);
    }
  }
  return [...seen.values()].sort((x, y) => x.priority - y.priority);
}

/** The five astronaut tabs (`?tab=`), Summary first. */
export const TABS = ['summary', 'states', 'trends', 'packets', 'notes'] as const;
export type Tab = (typeof TABS)[number];

export function isTab(value: unknown): value is Tab {
  return typeof value === 'string' && (TABS as readonly string[]).includes(value);
}

/** URL of the astronaut page on a tab. */
export function astronautHref(crewMember: string, tab: Tab = 'summary'): string {
  const base = `/astronaut/${encodeURIComponent(crewMember)}`;
  return tab === 'summary' ? base : `${base}?tab=${tab}`;
}

/** URL of a packet's own page. */
export function packetHref(crewMember: string, packetId: string): string {
  return `/astronaut/${encodeURIComponent(crewMember)}/packet/${encodeURIComponent(packetId)}`;
}

/** Unit as shown to the user (`unitLabel` from @haven/core). Single entry point for rows, packet page and trends. */
export function displayUnit(unit: string, lang: Language): string {
  return unitLabel(unit, lang);
}

/** Source of the latest reading of each indicator across visible packets (Assessment has no source). */
export function latestSources(packets: ReceivedPacket[]): Record<string, Reading['source']> {
  const out: Record<string, { at: number; source: Reading['source'] }> = {};
  for (const p of packets) {
    for (const r of p.readings) {
      const at = Date.parse(r.takenAt);
      const prev = out[r.indicator];
      if (!prev || at > prev.at) out[r.indicator] = { at, source: r.source };
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.source]));
}

/** Value of the latest categorical reading of each indicator (`heart-rhythm` → `sinus`); Assessment has none. */
export function latestCategories(packets: ReceivedPacket[]): Record<string, string> {
  const out: Record<string, { at: number; value: string }> = {};
  for (const p of packets) {
    for (const r of p.readings) {
      if (
        typeof r.value !== 'string' ||
        r.indicator === 'symptom' ||
        r.indicator === DIARY_INDICATOR
      )
        continue;
      const at = Date.parse(r.takenAt);
      const prev = out[r.indicator];
      if (!prev || at > prev.at) out[r.indicator] = { at, value: r.value };
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.value]));
}
