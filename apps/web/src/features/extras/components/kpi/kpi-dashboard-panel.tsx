import { loadConfig, unitLabel } from '@haven/core';
import { ChartLine } from 'lucide-react';
import { EmptyState } from '@/components/haven';
import { format, type Language, translate } from '@/lib/i18n';
import { defaultDashboard, KPI_CREW_SOURCE, KPI_INDICATORS } from '@/lib/kpi';
import type { ExtrasTexts } from '../../i18n';
import {
  decimalsFor,
  type KpiIndicatorInfo,
  type KpiMarker,
  type KpiSource,
} from '../../logic/kpi';
import { getKpiDashboard, getKpiSeries, listRules } from '../../server';
import { KpiDashboard } from './kpi-dashboard';
import { kpiTexts } from './texts';

export async function KpiDashboardPanel({
  mission,
  crew,
  lang,
  t,
}: {
  mission: string;
  crew: { id: string; name: string }[];
  lang: Language;
  t: ExtrasTexts;
}) {
  const config = loadConfig();
  const byId = new Map(config.indicators.map((i) => [i.id, i]));
  const ids = KPI_INDICATORS.filter((id) => byId.has(id));
  const [series, { versions }, saved] = await Promise.all([
    getKpiSeries(ids, mission),
    listRules(mission),
    getKpiDashboard(mission),
  ]);

  const withData = ids.filter((id) => (series.crew[id]?.length ?? 0) > 0);
  if (withData.length === 0) {
    return (
      <div data-testid="kpi-empty">
        <EmptyState
          icon={<ChartLine />}
          title={t.trendsEmptyTitle}
          description={t.trendsEmptyDetail}
        />
      </div>
    );
  }

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

  return (
    <KpiDashboard
      key={mission}
      mission={mission}
      lang={lang}
      indicators={indicators}
      sources={sources}
      series={{ mission: series.mission, crew: series.crew, members: series.members }}
      markers={markers}
      initial={
        saved
          ? { version: 1, range: saved.range, panels: saved.panels, layout: saved.layout }
          : null
      }
      fallback={defaultDashboard(withData)}
      texts={kpiTexts(t)}
    />
  );
}
