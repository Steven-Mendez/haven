import { loadConfig, unitLabel } from '@haven/core';
import { ChartLine, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { type ChartMarker, EmptyState, Section, SeriesChart, Sparkline } from '@/components/haven';
import { explain } from '@/components/haven/term';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, formatNumber, type Language, translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ExtrasTexts } from '../i18n';
import { getAggregates, listRules } from '../server';
import { ExportCsvButton } from './export-buttons';
import { IndicatorSelect } from './indicator-picker';

/** Indicators offered for crew trends (vault T03: bone loss, variability, sleep, mood, CO₂ first). */
export const TREND_OPTIONS = [
  'bone-loss',
  'hrv',
  'sleep',
  'mood',
  'cabin-co2',
  'stress',
  'heart-rate',
  'spo2',
  'weight',
  'reaction-time',
  'radiation-dose',
  'steps',
];
const VISIBLE_ROWS = 5;
const DAY_MS = 86_400_000;

type Point = { date: string; mean: number };

/** Two decimals for small values (bone loss %, CO₂ mmHg), none for large ones (steps). */
function decimalsFor(values: number[]) {
  const max = Math.max(0, ...values.map(Math.abs));
  return max < 10 ? 2 : max < 100 ? 1 : 0;
}

export async function TrendsPanel({
  mission,
  indicator: requested,
  lang,
  t,
}: {
  mission: string;
  indicator: string | undefined;
  lang: Language;
  t: ExtrasTexts;
}) {
  const config = loadConfig();
  const byId = new Map(config.indicators.map((i) => [i.id, i]));
  const ids = TREND_OPTIONS.filter((id) => byId.has(id));
  const [aggregates, { versions }] = await Promise.all([
    getAggregates(ids, mission),
    listRules(mission),
  ]);
  const series = ids.map((id) => ({
    id,
    name: translate(byId.get(id)?.name, lang),
    unitId: byId.get(id)?.unit ?? '',
    unit: unitLabel(byId.get(id)?.unit ?? '', lang),
    points: aggregates.indicators[id] ?? null,
  }));

  if (!series.some((s) => s.points !== null)) {
    return (
      <Section title={t.trendsTitle} description={t.trendsDescription}>
        <div data-testid="trends-empty">
          <EmptyState
            icon={<ChartLine />}
            title={t.trendsEmptyTitle}
            description={t.trendsEmptyDetail}
          />
        </div>
      </Section>
    );
  }

  const selected =
    series.find((s) => s.id === requested) ??
    series.find((s) => s.points?.length) ??
    (series[0] as (typeof series)[number]);
  const indicator = byId.get(selected.id);
  const markers = (points: Point[]): ChartMarker[] => {
    if (!points.length) return [];
    const from = Date.parse(points[0].date);
    const to = Date.parse(points[points.length - 1].date) + DAY_MS;
    return versions
      .filter((v) => Date.parse(v.sentAt) >= from && Date.parse(v.sentAt) <= to)
      .map((v) => ({ at: v.sentAt, label: format(t.markerRules, { version: v.version }) }));
  };
  const rows = series.flatMap((s) => (s.points ?? []).map((p) => [p.date, s.id, s.unitId, p.mean]));

  const row = (s: (typeof series)[number]) => {
    const last = s.points?.at(-1);
    const active = s.id === selected.id;
    return (
      <li key={s.id}>
        <Link
          href={`/trends?indicator=${s.id}`}
          scroll={false}
          aria-current={active ? 'true' : undefined}
          className={cn(
            'hover:bg-hover flex min-h-10 items-center gap-3 px-4 text-sm',
            active && 'bg-muted',
          )}
        >
          <span className="flex-1 truncate font-medium">{s.name}</span>
          {last ? (
            <>
              <Sparkline points={(s.points ?? []).map((p) => [p.date, p.mean])} />
              <span className="w-28 text-right tabular-nums">
                {formatNumber(last.mean, lang, decimalsFor([last.mean]))}
                <span className="text-muted-foreground ml-1 text-xs">{s.unit}</span>
              </span>
            </>
          ) : (
            <span className="text-muted-foreground text-xs">
              {s.points === null ? t.noGroupStat : t.noSeriesShort}
            </span>
          )}
          <ChevronRight aria-hidden="true" className="text-tertiary size-3.5" />
        </Link>
      </li>
    );
  };

  return (
    <Section
      title={t.trendsTitle}
      description={t.trendsDescription}
      actions={
        <ExportCsvButton
          filename={`haven-crew-trends-${mission}.csv`}
          header={['date', 'indicator', 'unit', 'mean']}
          rows={rows}
          label={t.exportCsv}
        />
      }
    >
      <IndicatorSelect
        options={series.map((s) => ({ id: s.id, name: s.name }))}
        selected={selected.id}
        label={t.chooseIndicators}
      />
      <div data-testid="trends-charts" className="rounded-xl border px-4 pt-3 pb-4">
        {selected.points === null ? (
          <EmptyState
            icon={<ChartLine />}
            title={selected.name}
            description={t.indicatorEmpty}
            className="min-h-48 border-0"
          />
        ) : (
          <SeriesChart
            lang={lang}
            title={`${selected.name} · ${t.meanOfCrew}`}
            unit={selected.unit}
            points={selected.points.map((p) => [p.date, p.mean])}
            normalRange={indicator?.green}
            markers={markers(selected.points)}
            decimals={decimalsFor(selected.points.map((p) => p.mean))}
            header="full"
            height={240}
            titleExplain={explain(selected.id, lang)}
            glossary={{ reference: explain('reference-range', lang) }}
          />
        )}
      </div>
      <ul
        className="divide-border-subtle divide-y overflow-hidden rounded-xl border"
        aria-label={t.chooseIndicators}
      >
        {series.slice(0, VISIBLE_ROWS).map(row)}
        {series.length > VISIBLE_ROWS ? (
          <li>
            <Collapsible defaultOpen={series.slice(VISIBLE_ROWS).some((s) => s.id === selected.id)}>
              <CollapsibleContent>
                <ul className="divide-border-subtle divide-y border-b">
                  {series.slice(VISIBLE_ROWS).map(row)}
                </ul>
              </CollapsibleContent>
              <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex min-h-9 w-full items-center gap-1 px-4 text-sm">
                {format(t.seeAll, { n: series.length })}
                <ChevronRight aria-hidden="true" className="size-4" />
              </CollapsibleTrigger>
            </Collapsible>
          </li>
        ) : null}
      </ul>
    </Section>
  );
}
