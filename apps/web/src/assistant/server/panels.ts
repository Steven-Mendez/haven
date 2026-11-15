import 'server-only';
import type { KpiData } from '@/features/extras/kpi-data';
import {
  dataEnd,
  fitSeries,
  inRange,
  inWindow,
  seriesPoints,
  seriesStats,
  windowFor,
} from '@/features/extras/logic/kpi';
import {
  KPI_CREW_SOURCE,
  type KpiDailyPoint,
  type KpiPanel,
  type KpiPanelType,
  type KpiRange,
  type KpiSeries,
  type KpiSeriesData,
} from '@/lib/kpi';
import type { PanelView } from '../types';

export type SeriesInput = { indicator: string; source?: string };

/** Series as the KPI model wants them, or why they cannot be drawn together. */
export function checkSeries(
  data: KpiData,
  type: KpiPanelType,
  input: SeriesInput[],
): { ok: true; series: KpiSeries[] } | { ok: false; error: string } {
  const series = input.map((s) => ({
    indicator: s.indicator,
    source: s.source || KPI_CREW_SOURCE,
  }));
  const indicators = new Set(data.indicators.map((i) => i.id));
  const sources = new Set(data.sources.map((s) => s.id));
  const unknown = series.find((s) => !indicators.has(s.indicator));
  if (unknown)
    return {
      ok: false,
      error: `Unknown indicator "${unknown.indicator}". Chartable indicators: ${[...indicators].join(', ')}.`,
    };
  const stranger = series.find((s) => !sources.has(s.source));
  if (stranger)
    return {
      ok: false,
      error: `Unknown source "${stranger.source}". Use "${KPI_CREW_SOURCE}" for the crew mean or a crew member id: ${[...sources].join(', ')}.`,
    };
  const fitted = fitSeries(type, series, data.indicators);
  if (fitted.length !== series.length)
    return {
      ok: false,
      error:
        type === 'stat' || type === 'gauge'
          ? `A ${type} panel shows exactly one series.`
          : 'A chart shares one axis: every series needs the same unit and there can be at most 5. Use a table, or separate panels, to mix units.',
    };
  return { ok: true, series: fitted };
}

/** The panel with only the data it draws, cut to its window. */
export function panelView(data: KpiData, panel: KpiPanel, range: KpiRange): PanelView {
  const indicators = new Set(panel.series.map((s) => s.indicator));
  const sources = new Set(panel.series.map((s) => s.source));
  const used: KpiSeriesData = {
    mission: data.series.mission,
    crew: Object.fromEntries(
      Object.entries(data.series.crew).filter(
        ([id]) => sources.has(KPI_CREW_SOURCE) && indicators.has(id),
      ),
    ),
    members: Object.fromEntries(
      Object.entries(data.series.members)
        .filter(([member]) => sources.has(member))
        .map(([member, byIndicator]) => [
          member,
          Object.fromEntries(Object.entries(byIndicator).filter(([id]) => indicators.has(id))),
        ]),
    ),
  };
  const end = dataEnd(used, { version: 1, range, panels: [panel], layout: [] });
  const win = windowFor(range, end);
  const cut = (points: KpiDailyPoint[] | null) => (points ? inWindow(points, win) : points);
  return {
    panel,
    range,
    indicators: data.indicators.filter((i) => indicators.has(i.id)),
    sources: data.sources.filter((s) => sources.has(s.id)),
    series: {
      mission: used.mission,
      crew: Object.fromEntries(Object.entries(used.crew).map(([id, points]) => [id, cut(points)])),
      members: Object.fromEntries(
        Object.entries(used.members).map(([member, byIndicator]) => [
          member,
          Object.fromEntries(
            Object.entries(byIndicator).map(([id, points]) => [id, inWindow(points, win)]),
          ),
        ]),
      ),
    },
    markers: data.markers,
    end,
  };
}

const round = (value: number, decimals: number) => Number(value.toFixed(decimals + 1));

/** The numbers behind a panel, small enough for the model to read and comment on. */
export function summarize(view: PanelView, options: { dailyValues?: boolean } = {}) {
  const win = windowFor(view.range, view.end);
  return {
    period: { range: view.range, from: win.from, to: win.to },
    series: view.panel.series.map((s) => {
      const info = view.indicators.find((i) => i.id === s.indicator);
      const points = inWindow(seriesPoints(view.series, s), win);
      const stats = seriesStats(points);
      const decimals = info?.decimals ?? 1;
      const base = {
        indicator: s.indicator,
        name: info?.name ?? s.indicator,
        unit: info?.unit ?? '',
        source: s.source,
        sourceName: view.sources.find((x) => x.id === s.source)?.name ?? s.source,
        greenRange: info?.green ?? null,
        daysWithData: stats?.count ?? 0,
      };
      if (!stats) return base;
      return {
        ...base,
        first: { date: stats.first.date, value: round(stats.first.mean, decimals) },
        last: { date: stats.last.date, value: round(stats.last.mean, decimals) },
        min: round(stats.min, decimals),
        max: round(stats.max, decimals),
        mean: round(stats.mean, decimals),
        change: round(stats.delta, decimals),
        ...(info?.green
          ? { daysOutsideGreen: points.filter((p) => inRange(p.mean, info.green) === false).length }
          : {}),
        ...(options.dailyValues
          ? { daily: points.map((p) => [p.date, round(p.mean, decimals)] as const) }
          : {}),
      };
    }),
  };
}
