'use client';

import { Download } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { KpiPanelBody } from '@/features/extras/components/kpi/kpi-panel';
import { type KpiEnv, resolvePanel } from '@/features/extras/components/kpi/model';
import { type KpiTexts, rangeLong } from '@/features/extras/components/kpi/texts';
import type { Language } from '@/lib/i18n';
import type { KpiPanelType } from '@/lib/kpi';
import { cn } from '@/lib/utils';
import type { AssistantTexts } from '../i18n';
import type { PanelView } from '../types';

const HEIGHT: Record<KpiPanelType, string> = {
  timeseries: 'h-72 lg:h-80',
  bars: 'h-72 lg:h-80',
  stat: 'h-36',
  gauge: 'h-48',
  table: 'max-h-80',
};

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(','),
    )
    .join('\n');
  const url = URL.createObjectURL(new Blob([`${csv}\n`], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** A panel Orion drew: the KPI page's own chart, stat, gauge or table, framed for the chat. */
export function PanelCard({
  view,
  lang,
  t,
  kpi,
}: {
  view: PanelView;
  lang: Language;
  t: AssistantTexts;
  kpi: KpiTexts;
}) {
  const env: KpiEnv = useMemo(
    () => ({
      lang,
      t: kpi,
      indicators: view.indicators,
      byId: new Map(view.indicators.map((i) => [i.id, i])),
      sources: new Map(view.sources.map((s) => [s.id, s])),
      data: view.series,
      markers: view.markers,
      end: view.end,
      range: view.range,
    }),
    [view, lang, kpi],
  );
  const model = useMemo(() => resolvePanel(view.panel, env), [view.panel, env]);
  const wide = view.panel.type !== 'stat' && view.panel.type !== 'gauge';

  const exportCsv = () => {
    const days = [...new Set(model.series.flatMap((s) => s.points.map((p) => p.date)))].sort();
    const byDay = model.series.map((s) => new Map(s.points.map((p) => [p.date, p.mean])));
    downloadCsv(`${view.series.mission}-${view.panel.series[0]?.indicator ?? 'kpi'}.csv`, [
      [t.panelDate, ...model.series.map((s) => (s.unit ? `${s.name} (${s.unit})` : s.name))],
      ...days.map((day) => [day, ...byDay.map((m) => m.get(day) ?? '')]),
    ]);
  };

  return (
    <section
      aria-label={model.title}
      data-testid="orion-panel"
      className={cn(
        'bg-card @container flex min-w-0 flex-col overflow-hidden rounded-xl border',
        wide ? 'w-full' : 'w-full max-w-xs',
      )}
    >
      <header className="flex h-9 shrink-0 items-center gap-2 pr-1.5 pl-3">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h3 className="truncate text-xs font-medium">{model.title}</h3>
          {/* On a narrow card the title needs the room more than the period does. */}
          <span className="text-tertiary text-2xs hidden shrink-0 @[17rem]:inline">
            {rangeLong(kpi, model.range)}
          </span>
        </div>
        {model.hasData ? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t.panelCsv}
            title={t.panelCsv}
            onClick={exportCsv}
          >
            <Download />
          </Button>
        ) : null}
      </header>
      <div className={cn('flex min-h-0 min-w-0 flex-col px-3 pb-3', HEIGHT[view.panel.type])}>
        <KpiPanelBody model={model} env={env} />
      </div>
    </section>
  );
}
