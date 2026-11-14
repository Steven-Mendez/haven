import type { Assessment, Indicator } from '@haven/core';
import { useState } from 'react';
import { View } from 'react-native';
import {
  format,
  havenTexts,
  pointLevel,
  SegmentedControl,
  SeriesChart,
  sourceLabel,
  useUnitLabel,
} from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { useReadings } from '@/shared/data';
import { useLanguage, useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { texts } from '../i18n';
import { formatNumber } from '../logic/format';
import {
  CHART_RANGES,
  type ChartRange,
  categoriesOf,
  chartPoints,
  rangeDomain,
} from '../logic/series';
import { useCategoryText } from './use-category-text';

const HISTORY = 6;

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View
      className="flex-1 gap-1"
      accessible
      accessibilityLabel={`${label}: ${value} ${unit ?? ''}`}
    >
      <Text className="text-title font-bold tabular-nums">
        {value}
        {unit ? (
          <Text className="text-muted-foreground text-caption font-normal">{` ${unit}`}</Text>
        ) : null}
      </Text>
      <Text className="text-tertiary text-caption">{label}</Text>
    </View>
  );
}

export function TrendSection({
  indicator,
  assessment,
  onScrub,
}: {
  indicator: Indicator;
  assessment: Assessment | undefined;
  onScrub?: (point: [number, number] | null) => void;
}) {
  const t = useTexts(texts);
  const h = useTexts(havenTexts);
  const unitText = useUnitLabel();
  const language = useLanguage();
  const categoryOf = useCategoryText();
  const label = (v: string) => categoryOf(indicator, v);
  const readings = useReadings(indicator.id);
  const [range, setRange] = useState<ChartRange>('week');

  const domain = rangeDomain(range, Date.now());
  const data = chartPoints(indicator, readings, domain);
  const isCategory = indicator.kind === 'category';
  const categories = categoriesOf(indicator);
  const rangeLabel: Record<ChartRange, string> = {
    day: h.range1d,
    week: h.range7d,
    month: h.range4w,
  };
  const rangeA11y: Record<ChartRange, string> = {
    day: t.rangeDay,
    week: t.rangeWeek,
    month: t.rangeMonth,
  };
  const fmt = (v: number) => formatNumber(v, language);
  const unit = isCategory ? undefined : unitText(indicator.unit);
  const values = data.map(([, v]) => v);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
  const lo = values.length ? Math.min(...values) : undefined;
  const hi = values.length ? Math.max(...values) : undefined;
  const history = [...readings].slice(-HISTORY).reverse();
  const valueText = (v: unknown) =>
    isCategory ? label(String(v)) : `${fmt(Number(v))}${unit ? ` ${unit}` : ''}`;
  const when = (iso: string) =>
    new Date(iso).toLocaleString(language, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <View className="gap-5">
      <SegmentedControl
        options={CHART_RANGES.map((r) => ({
          value: r,
          label: rangeLabel[r],
          accessibilityLabel: rangeA11y[r],
        }))}
        value={range}
        onChange={setRange}
        accessibilityLabel={t.trend}
      />
      <SeriesChart
        data={data}
        baseline={isCategory ? undefined : assessment?.baseline}
        referenceRange={isCategory ? undefined : indicator.green}
        levelAt={isCategory ? undefined : (_, v) => pointLevel(indicator, v)}
        lastLevel={assessment?.level}
        unit={isCategory ? undefined : indicator.unit}
        timeDomain={domain}
        height={200}
        bucketMs={range === 'day' ? 0 : 86_400_000}
        onScrub={onScrub}
        className="-mx-4"
        formatTime={
          range === 'day'
            ? (ms) =>
                new Date(ms).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })
            : undefined
        }
        formatValue={isCategory ? (v) => label(categories[Math.round(v)] ?? '') : (v) => fmt(v)}
      />
      {isCategory ? (
        <Text className="text-tertiary text-caption">
          {format(t.chartCategory, {
            a: label(categories[0] ?? ''),
            b: label(categories[categories.length - 1] ?? ''),
          })}
        </Text>
      ) : null}

      {!isCategory ? (
        <View className="border-border flex-row gap-4 border-t pt-4">
          <Stat
            label={`${h.average} · ${rangeLabel[range]}`}
            value={avg === undefined ? '—' : fmt(avg)}
            unit={avg === undefined ? undefined : unit}
          />
          <Stat
            label={assessment?.baseline ? h.personalRange : `${h.low}–${h.high}`}
            value={
              assessment?.baseline
                ? `${fmt(assessment.baseline.range[0])}–${fmt(assessment.baseline.range[1])}`
                : lo === undefined || hi === undefined
                  ? '—'
                  : `${fmt(lo)}–${fmt(hi)}`
            }
            unit={unit}
          />
        </View>
      ) : null}

      {history.length > 0 ? (
        <View className="gap-3">
          <Text className="text-muted-foreground text-micro font-semibold uppercase">
            {h.history}
          </Text>
          <View>
            {history.map((r, i) => {
              const n = Number(r.value);
              const out =
                !isCategory &&
                Number.isFinite(n) &&
                (n < indicator.green[0] || n > indicator.green[1]);
              return (
                <View key={r.id} className="flex-row gap-3">
                  <View className="w-3 items-center">
                    <View
                      className={cn(
                        'mt-1.5 h-2 w-2 rounded-full',
                        i === 0 ? 'bg-foreground' : 'border-border-strong border',
                      )}
                    />
                    {i < history.length - 1 ? (
                      <View className="bg-border mt-1 w-px flex-1" />
                    ) : null}
                  </View>
                  <View className="flex-1 flex-row items-start justify-between gap-3 pb-4">
                    <View className="flex-1 gap-0.5">
                      <Text
                        className={cn(
                          'text-body-sm font-semibold tabular-nums',
                          out && 'text-level-amber',
                        )}
                      >
                        {valueText(r.value)}
                      </Text>
                      <Text className="text-tertiary text-caption">{sourceLabel(h, r.source)}</Text>
                    </View>
                    <Text className="text-tertiary text-caption tabular-nums">
                      {when(r.takenAt)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}
