import 'server-only';
import { loadConfig, unitLabel } from '@haven/core';
import { format, type Language, translate } from '@/lib/i18n';
import { KPI_CREW_SOURCE, KPI_INDICATORS, type KpiDashboard, type KpiSeriesData } from '@/lib/kpi';
import type { ExtrasTexts } from './i18n';
import { decimalsFor, type KpiIndicatorInfo, type KpiMarker, type KpiSource } from './logic/kpi';
import { getKpiDashboard, getKpiSeries, listRules } from './server';

export type KpiData = {
  series: KpiSeriesData;
  /** Indicators the KPI views can plot, in zone order. */
  indicators: KpiIndicatorInfo[];
  /** Ids of the indicators with at least one day of crew data. */
  withData: string[];
  /** The crew mean first, then each crew member. */
  sources: KpiSource[];
  /** When Earth sent each rules version. */
  markers: KpiMarker[];
  saved: KpiDashboard | null;
};

/** Everything the KPI dashboard and the assistant's charts need for one mission. */
export async function loadKpiData({
  mission,
  crew,
  lang,
  t,
}: {
  mission: string;
  crew: { id: string; name: string }[];
  lang: Language;
  t: Pick<ExtrasTexts, 'meanOfCrew' | 'markerRules'>;
}): Promise<KpiData> {
  const config = loadConfig();
  const byId = new Map(config.indicators.map((i) => [i.id, i]));
  const ids = KPI_INDICATORS.filter((id) => byId.has(id));
  const [series, { versions }, saved] = await Promise.all([
    getKpiSeries(ids, mission),
    listRules(mission),
    getKpiDashboard(mission),
  ]);

  const zoneOrder = config.zones.map((z) => z.id);
  const zoneName = new Map(config.zones.map((z) => [z.id, translate(z.name, lang)]));
  const indicators: KpiIndicatorInfo[] = ids
    .map((id) => {
      const indicator = byId.get(id);
      const values = [
        ...(series.crew[id] ?? []),
        ...Object.values(series.members).flatMap((m) => m[id] ?? []),
      ].map((p) => p.mean);
      const green = indicator?.green;
      return {
        id,
        name: translate(indicator?.name, lang),
        unit: unitLabel(indicator?.unit ?? '', lang),
        unitId: indicator?.unit ?? '',
        zone: indicator?.zone ?? '',
        zoneName: zoneName.get(indicator?.zone ?? '') ?? indicator?.zone ?? '',
        green: green ? ([green[0], green[1]] as [number, number]) : null,
        decimals: values.length ? decimalsFor(values) : 0,
      };
    })
    .sort((a, b) => {
      const za = zoneOrder.indexOf(a.zone);
      const zb = zoneOrder.indexOf(b.zone);
      return (za < 0 ? 99 : za) - (zb < 0 ? 99 : zb);
    });

  const sources: KpiSource[] = [{ id: KPI_CREW_SOURCE, name: t.meanOfCrew }];
  for (const member of crew) sources.push({ id: member.id, name: member.name });
  for (const id of Object.keys(series.members)) {
    if (!sources.some((s) => s.id === id)) sources.push({ id, name: id });
  }

  const markers: KpiMarker[] = versions.map((v) => ({
    at: v.sentAt,
    label: format(t.markerRules, { version: v.version }),
  }));

  return {
    series: { mission: series.mission, crew: series.crew, members: series.members },
    indicators,
    withData: ids.filter((id) => (series.crew[id]?.length ?? 0) > 0),
    sources,
    markers,
    saved,
  };
}
