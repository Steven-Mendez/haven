import { ChartLine } from 'lucide-react';
import { EmptyState } from '@/components/haven';
import type { Language } from '@/lib/i18n';
import { defaultDashboard } from '@/lib/kpi';
import type { ExtrasTexts } from '../../i18n';
import { loadKpiData } from '../../kpi-data';
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
  const { series, indicators, withData, sources, markers, saved } = await loadKpiData({
    mission,
    crew,
    lang,
    t,
  });

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

  return (
    <KpiDashboard
      key={mission}
      mission={mission}
      lang={lang}
      indicators={indicators}
      sources={sources}
      series={series}
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
