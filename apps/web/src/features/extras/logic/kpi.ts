import {
  KPI_COLUMNS,
  KPI_CREW_SOURCE,
  KPI_LIMITS,
  KPI_SINGLE_SERIES,
  type KpiDailyPoint,
  type KpiDashboard,
  type KpiLayoutItem,
  type KpiPanel,
  type KpiPanelType,
  type KpiRange,
  type KpiSeries,
  type KpiSeriesData,
} from '@/lib/kpi';

export type KpiIndicatorInfo = {
  id: string;
  name: string;
  unit: string;
  unitId: string;
  zone: string;
  zoneName: string;
  green: [number, number] | null;
  decimals: number;
};

export type KpiSource = { id: string; name: string };
export type KpiMarker = { at: string; label: string };
export type KpiWindow = { from: string | null; to: string | null };
export type KpiStats = {
  first: KpiDailyPoint;
  last: KpiDailyPoint;
  min: number;
  max: number;
  mean: number;
  delta: number;
  count: number;
};

const DAY_MS = 86_400_000;

export const RANGE_DAYS: Record<Exclude<KpiRange, 'all'>, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

export const CHART_TYPES: readonly KpiPanelType[] = ['timeseries', 'bars'];

export const DEFAULT_SIZE: Record<KpiPanelType, { w: number; h: number }> = {
  stat: { w: 3, h: 3 },
  gauge: { w: 3, h: 4 },
  timeseries: { w: 6, h: 6 },
  bars: { w: 6, h: 6 },
  table: { w: 6, h: 6 },
};

export const dayMs = (date: string) => Date.parse(`${date}T00:00:00Z`);

export function addDays(date: string, days: number): string {
  return new Date(dayMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export const isSingleSeries = (type: KpiPanelType) => KPI_SINGLE_SERIES.includes(type);
export const isChart = (type: KpiPanelType) => CHART_TYPES.includes(type);
export const showsReference = (panel: KpiPanel) => panel.reference !== false;
export const showsMarkers = (panel: KpiPanel) =>
  panel.type === 'timeseries' && panel.markers === true;

/** Daily points for one series, or null when the indicator/source has nothing at all. */
export function seriesPoints(data: KpiSeriesData, series: KpiSeries): KpiDailyPoint[] | null {
  const points =
    series.source === KPI_CREW_SOURCE
      ? data.crew[series.indicator]
      : data.members[series.source]?.[series.indicator];
  if (!points?.length) return null;
  return [...points]
    .filter((p) => Number.isFinite(p.mean) && Number.isFinite(dayMs(p.date)))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function latest(lists: (KpiDailyPoint[] | null)[]): string | null {
  let end: string | null = null;
  for (const list of lists)
    for (const p of list ?? []) if (end === null || p.date > end) end = p.date;
  return end;
}

/**
 * The day every window ends on: the latest day with data among the dashboard's series (falling
 * back to any data at all), so historical missions still show their last stretch.
 */
export function dataEnd(data: KpiSeriesData, dashboard: KpiDashboard): string | null {
  const used = latest(dashboard.panels.flatMap((p) => p.series.map((s) => seriesPoints(data, s))));
  if (used) return used;
  return latest([
    ...Object.values(data.crew),
    ...Object.values(data.members).flatMap((m) => Object.values(m)),
  ]);
}

export function windowFor(range: KpiRange, end: string | null): KpiWindow {
  if (!end) return { from: null, to: null };
  if (range === 'all') return { from: null, to: end };
  return { from: addDays(end, -(RANGE_DAYS[range] - 1)), to: end };
}

export function inWindow(points: KpiDailyPoint[] | null, win: KpiWindow): KpiDailyPoint[] {
  if (!points) return [];
  return points.filter(
    (p) => (win.from === null || p.date >= win.from) && (win.to === null || p.date <= win.to),
  );
}

/** First and last day a set of windowed series actually covers (for an 'all' window). */
export function windowSpan(win: KpiWindow, lists: KpiDailyPoint[][]): [string, string] | null {
  const dates = lists.flat().map((p) => p.date);
  if (!dates.length) return null;
  const sorted = dates.sort();
  const from = win.from ?? (sorted[0] as string);
  const to = win.to ?? (sorted.at(-1) as string);
  return [from, to];
}

export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to && days.length < 5000; d = addDays(d, 1)) days.push(d);
  return days;
}

export function seriesStats(points: KpiDailyPoint[]): KpiStats | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const values = points.map((p) => p.mean);
  return {
    first,
    last,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    delta: last.mean - first.mean,
    count: points.length,
  };
}

export function inRange(value: number, green: [number, number] | null): boolean | null {
  if (!green) return null;
  return value >= green[0] && value <= green[1];
}

export function decimalsFor(values: number[]): number {
  const max = Math.max(0, ...values.map(Math.abs));
  return max < 10 ? 2 : max < 100 ? 1 : 0;
}

/**
 * Value extent for a chart's y axis. The data decides it; a reference bound only joins when it lies
 * inside the data extent or within one data span of it, so a far-away bound (100 000 steps) never
 * squashes the series. Bounds left out are simply clipped by the plot.
 */
export function valueExtent(
  values: number[],
  reference: readonly [number, number] | null = null,
): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return reference ? [reference[0], reference[1]] : [0, 1];
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 1e-9);
  for (const bound of reference ?? []) {
    if (bound >= lo - span && bound <= hi + span) {
      lo = Math.min(lo, bound);
      hi = Math.max(hi, bound);
    }
  }
  return [lo, hi];
}

/** Clean round ticks (1, 2, 2.5, 5 × 10ⁿ) covering [lo, hi]; ~3–5 ticks. */
export function niceScale(
  lo: number,
  hi: number,
  { zero = false, target = 4 }: { zero?: boolean; target?: number } = {},
): { ticks: number[]; domain: [number, number] } {
  let min = Math.min(lo, hi);
  let max = Math.max(lo, hi);
  if (zero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { ticks: [0, 1], domain: [0, 1] };
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min = zero && min >= 0 ? 0 : min - pad;
    max += pad;
  }
  const raw = (max - min) / Math.max(1, target - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step + 1e-9) * step;
  const ticks: number[] = [];
  for (let v = start; v < max + step - 1e-9 && ticks.length < 20; v += step) {
    ticks.push(Number(v.toPrecision(12)));
  }
  return { ticks, domain: [ticks[0] ?? 0, ticks.at(-1) ?? 1] };
}

export function defaultTitle(
  panel: Pick<KpiPanel, 'type' | 'series'>,
  indicators: Map<string, KpiIndicatorInfo>,
  sources: Map<string, KpiSource>,
  typeName: string,
): string {
  const [first] = panel.series;
  if (!first) return typeName;
  const name = indicators.get(first.indicator)?.name ?? first.indicator;
  if (panel.series.length === 1) {
    if (first.source === KPI_CREW_SOURCE) return name;
    return `${name} · ${sources.get(first.source)?.name ?? first.source}`;
  }
  if (panel.series.every((s) => s.indicator === first.indicator)) return name;
  return typeName;
}

export const sharedIndicator = (panel: Pick<KpiPanel, 'series'>): string | null => {
  const first = panel.series[0]?.indicator;
  return first && panel.series.every((s) => s.indicator === first) ? first : null;
};

/** Indicators that may be plotted alongside the panel's first series (one axis, one unit). */
export function compatibleIndicators(
  type: KpiPanelType,
  series: KpiSeries[],
  indicators: KpiIndicatorInfo[],
): KpiIndicatorInfo[] {
  const first = series[0];
  if (!isChart(type) || !first) return indicators;
  const unit = indicators.find((i) => i.id === first.indicator)?.unitId;
  if (unit === undefined) return indicators;
  return indicators.filter((i) => i.unitId === unit);
}

/** Drops series that no longer fit the panel type (single series, or one unit for charts). */
export function fitSeries(
  type: KpiPanelType,
  series: KpiSeries[],
  indicators: KpiIndicatorInfo[],
): KpiSeries[] {
  if (isSingleSeries(type)) return series.slice(0, 1);
  const allowed = new Set(compatibleIndicators(type, series, indicators).map((i) => i.id));
  return series
    .filter((s, index) => index === 0 || allowed.has(s.indicator))
    .slice(0, KPI_LIMITS.series);
}

export function retypePanel(
  panel: KpiPanel,
  type: KpiPanelType,
  indicators: KpiIndicatorInfo[],
): KpiPanel {
  const { markers, ...rest } = panel;
  return {
    ...rest,
    type,
    series: fitSeries(type, panel.series, indicators),
    ...(type === 'timeseries' && markers !== undefined ? { markers } : {}),
  };
}

/** A series to append: an unused compatible indicator with data, else the first compatible. */
export function nextSeries(
  panel: KpiPanel,
  indicators: KpiIndicatorInfo[],
  withData: Set<string>,
  sources: string[] = [KPI_CREW_SOURCE],
): KpiSeries | null {
  const options = compatibleIndicators(panel.type, panel.series, indicators);
  const used = new Set(panel.series.map((s) => s.indicator));
  const fresh = options.find((i) => withData.has(i.id) && !used.has(i.id));
  if (fresh) return { indicator: fresh.id, source: KPI_CREW_SOURCE };
  // No other indicator with data: compare the same indicator across another source.
  const taken = new Set(panel.series.map((s) => `${s.indicator}|${s.source}`));
  for (const indicator of used) {
    const source = sources.find((src) => !taken.has(`${indicator}|${src}`));
    if (source) return { indicator, source };
  }
  // Otherwise an unused indicator without data yet; never an exact duplicate.
  const pick = options.find((i) => !used.has(i.id));
  return pick ? { indicator: pick.id, source: KPI_CREW_SOURCE } : null;
}

export const layoutBottom = (layout: KpiLayoutItem[]) =>
  layout.reduce((max, l) => Math.max(max, l.y + l.h), 0);

export function placeAtBottom(layout: KpiLayoutItem[], id: string, w: number, h: number) {
  return { i: id, x: 0, y: layoutBottom(layout), w: Math.min(w, KPI_COLUMNS), h };
}

export function panelId(uuid: string): string {
  const id = uuid
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, KPI_LIMITS.id);
  return id || 'panel';
}

export function newPanel(
  type: KpiPanelType,
  id: string,
  indicators: KpiIndicatorInfo[],
  withData: Set<string>,
): KpiPanel {
  const first = indicators.find((i) => withData.has(i.id)) ?? indicators[0];
  return {
    id,
    type,
    series: first ? [{ indicator: first.id, source: KPI_CREW_SOURCE }] : [],
    reference: true,
    ...(type === 'timeseries' ? { markers: false } : {}),
  };
}

export function addPanel(dashboard: KpiDashboard, panel: KpiPanel): KpiDashboard {
  const size = DEFAULT_SIZE[panel.type];
  return {
    ...dashboard,
    panels: [...dashboard.panels, panel],
    layout: [...dashboard.layout, placeAtBottom(dashboard.layout, panel.id, size.w, size.h)],
  };
}

export function removePanel(dashboard: KpiDashboard, id: string): KpiDashboard {
  return {
    ...dashboard,
    panels: dashboard.panels.filter((p) => p.id !== id),
    layout: dashboard.layout.filter((l) => l.i !== id),
  };
}

export function updatePanel(dashboard: KpiDashboard, panel: KpiPanel): KpiDashboard {
  return { ...dashboard, panels: dashboard.panels.map((p) => (p.id === panel.id ? panel : p)) };
}

/** Copies a panel with a new id, placed right below the original (others shift down). */
export function duplicatePanel(dashboard: KpiDashboard, id: string, newId: string): KpiDashboard {
  const panel = dashboard.panels.find((p) => p.id === id);
  if (!panel) return dashboard;
  const at = dashboard.layout.find((l) => l.i === id);
  const size = DEFAULT_SIZE[panel.type];
  const item: KpiLayoutItem = at
    ? { i: newId, x: at.x, y: at.y + at.h, w: at.w, h: at.h }
    : placeAtBottom(dashboard.layout, newId, size.w, size.h);
  const layout = dashboard.layout.map((l) =>
    l.y >= item.y && l.x < item.x + item.w && item.x < l.x + l.w ? { ...l, y: l.y + item.h } : l,
  );
  const index = dashboard.panels.indexOf(panel);
  const panels = [...dashboard.panels];
  panels.splice(index + 1, 0, { ...panel, id: newId });
  return { ...dashboard, panels, layout: [...layout, item] };
}

/** Panel ids in reading order (top to bottom, left to right) for the single-column view. */
export function stackOrder(dashboard: KpiDashboard): string[] {
  const at = new Map(dashboard.layout.map((l) => [l.i, l]));
  return dashboard.panels
    .map((p, index) => ({ id: p.id, l: at.get(p.id), index }))
    .sort(
      (a, b) =>
        (a.l?.y ?? Number.MAX_SAFE_INTEGER) - (b.l?.y ?? Number.MAX_SAFE_INTEGER) ||
        (a.l?.x ?? 0) - (b.l?.x ?? 0) ||
        a.index - b.index,
    )
    .map((p) => p.id);
}

/** Every panel gets a layout item (missing ones are placed at the bottom). */
export function completeLayout(dashboard: KpiDashboard): KpiLayoutItem[] {
  const ids = new Set(dashboard.panels.map((p) => p.id));
  const layout = dashboard.layout.filter((l) => ids.has(l.i));
  for (const p of dashboard.panels) {
    if (layout.some((l) => l.i === p.id)) continue;
    const size = DEFAULT_SIZE[p.type];
    layout.push(placeAtBottom(layout, p.id, size.w, size.h));
  }
  return layout;
}

const layoutKey = (l: KpiLayoutItem) => `${l.i}:${l.x},${l.y},${l.w},${l.h}`;

export function sameLayout(a: KpiLayoutItem[], b: KpiLayoutItem[]): boolean {
  if (a.length !== b.length) return false;
  const keys = new Set(a.map(layoutKey));
  return b.every((l) => keys.has(layoutKey(l)));
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  return value;
}

export function sameDashboard(a: KpiDashboard, b: KpiDashboard): boolean {
  const { layout: la, ...ra } = a;
  const { layout: lb, ...rb } = b;
  return JSON.stringify(canonical(ra)) === JSON.stringify(canonical(rb)) && sameLayout(la, lb);
}

/** Pixel height of a panel `h` rows tall, matching the grid's row height and margin. */
export const rowsToPx = (h: number, rowHeight: number, margin: number) =>
  h * rowHeight + Math.max(0, h - 1) * margin;

/** Decimals needed to print every tick distinctly (at most 2). */
export function tickDecimals(ticks: number[]): number {
  return Math.min(
    2,
    Math.max(
      0,
      ...ticks.map((t) => (String(Number(t.toPrecision(10))).split('.')[1] ?? '').length),
    ),
  );
}
