import type { CSSProperties } from 'react';
import { formatNumber, type Language } from '@/lib/i18n';
import {
  KPI_CREW_SOURCE,
  type KpiDailyPoint,
  type KpiPanel,
  type KpiRange,
  type KpiSeries,
  type KpiSeriesData,
} from '@/lib/kpi';
import {
  defaultTitle,
  inWindow,
  type KpiIndicatorInfo,
  type KpiMarker,
  type KpiSource,
  type KpiWindow,
  seriesPoints,
  sharedIndicator,
  showsReference,
  windowFor,
  windowSpan,
} from '../../logic/kpi';
import { type KpiTexts, typeName } from './texts';

export type KpiEnv = {
  lang: Language;
  t: KpiTexts;
  indicators: KpiIndicatorInfo[];
  byId: Map<string, KpiIndicatorInfo>;
  sources: Map<string, KpiSource>;
  data: KpiSeriesData;
  markers: KpiMarker[];
  /** Latest day with data on the dashboard: every window ends here. */
  end: string | null;
  /** The dashboard-wide period chosen in the toolbar. */
  range: KpiRange;
};

export type ResolvedSeries = {
  key: string;
  series: KpiSeries;
  info: KpiIndicatorInfo | null;
  /** Full name: "Indicator · Source". */
  name: string;
  /** Shortest name that tells the panel's series apart (used in legends). */
  label: string;
  unit: string;
  decimals: number;
  points: KpiDailyPoint[];
  color: string;
};

export type ResolvedPanel = {
  panel: KpiPanel;
  title: string;
  range: KpiRange;
  ownRange: boolean;
  win: KpiWindow;
  span: [string, string] | null;
  series: ResolvedSeries[];
  hasData: boolean;
  /** Indicator shared by every series, if any. */
  indicator: KpiIndicatorInfo | null;
  /** Reference band to draw (shared indicator with a green range, and enabled). */
  reference: [number, number] | null;
  decimals: number;
};

/** Big standalone numbers use proportional figures (the body defaults to tabular). */
export const PROPORTIONAL: CSSProperties = { fontFeatureSettings: '"pnum", "cv11", "ss01"' };

export const seriesColor = (index: number, count: number) =>
  count < 2 ? 'var(--chart-line)' : `var(--kpi-series-${(index % 5) + 1})`;

export const sourceName = (env: KpiEnv, id: string) =>
  id === KPI_CREW_SOURCE ? env.t.meanOfCrew : (env.sources.get(id)?.name ?? id);

export function resolvePanel(panel: KpiPanel, env: KpiEnv): ResolvedPanel {
  const range = panel.range ?? env.range;
  const win = windowFor(range, env.end);
  const shared = sharedIndicator(panel);
  const sharedSource =
    panel.series.length > 0 && panel.series.every((s) => s.source === panel.series[0]?.source);
  const series = panel.series.map((s, index): ResolvedSeries => {
    const info = env.byId.get(s.indicator) ?? null;
    const indicatorName = info?.name ?? s.indicator;
    const source = sourceName(env, s.source);
    const known = info !== null && (s.source === KPI_CREW_SOURCE || env.sources.has(s.source));
    return {
      key: `${index}-${s.indicator}-${s.source}`,
      series: s,
      info,
      name: `${indicatorName} · ${source}`,
      label: shared ? source : sharedSource ? indicatorName : `${indicatorName} · ${source}`,
      unit: info?.unit ?? '',
      decimals: info?.decimals ?? 0,
      points: known ? inWindow(seriesPoints(env.data, s), win) : [],
      color: seriesColor(index, panel.series.length),
    };
  });
  const indicator = shared ? (env.byId.get(shared) ?? null) : null;
  return {
    panel,
    title:
      panel.title?.trim() ||
      defaultTitle(panel, env.byId, env.sources, typeName(env.t, panel.type)),
    range,
    ownRange: panel.range !== undefined && panel.range !== env.range,
    win,
    span: windowSpan(
      win,
      series.map((s) => s.points),
    ),
    series,
    hasData: series.some((s) => s.points.length > 0),
    indicator,
    reference: indicator?.green && showsReference(panel) ? indicator.green : null,
    decimals: Math.max(0, ...series.map((s) => s.decimals)),
  };
}

export const fmt = (env: KpiEnv, value: number, decimals: number) =>
  formatNumber(value, env.lang, decimals);

export function signed(env: KpiEnv, value: number, decimals: number) {
  // Signs follow the shown (rounded) value: a delta that rounds to zero reads "±0", not "+0".
  const shown = Number(value.toFixed(decimals));
  const sign = shown > 0 ? '+' : shown < 0 ? '−' : '±';
  return `${sign}${formatNumber(Math.abs(value), env.lang, decimals)}`;
}
