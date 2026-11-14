import { configForEnvironment, type Indicator } from '@haven/core';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  type ChartEvent,
  DataLabel,
  format,
  havenTexts,
  LEVEL_TEXT_CLASS,
  LevelSymbol,
  levelLabel,
  pointLevel,
  SeriesChart,
  useUnitLabel,
} from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { useAgeMin, useAssessment, useBaseline, useMission, useReadings } from '@/shared/data';
import { useLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { texts } from '../i18n';
import { aggregateSeries, type TrendRange } from '../logic/series';

type Props = {
  indicator: Indicator;
  range: TrendRange;
  window: [number, number];
  events: ChartEvent[];
  /** Range control, between the hero and the chart. */
  controls?: ReactNode;
};

const formatNumber = (v: number) => String(Math.round(v * 10) / 10);

/**
 * Single-chart view (Google Health · weight, DESIGN_SYSTEM §3.3 and §8.8): the latest value appears
 * once (the chart readout is off), the grey baseline band, one line joining legend and baseline,
 * and the source in `DataLabel`. A row at the end opens the indicator screen.
 */
export function TrendCard({ indicator, range, window, events, controls }: Props) {
  const h = useTexts(havenTexts);
  const t = useTexts(texts);
  const unitText = useUnitLabel();
  const translate = useTranslate();
  const language = useLanguage();
  const readings = useReadings(indicator.id);
  const mission = useMission();
  const rules = useMemo(
    () =>
      configForEnvironment(config, mission.environment).indicators.find(
        (i) => i.id === indicator.id,
      ) ?? indicator,
    [indicator, mission.environment],
  );
  const baseline = useBaseline(indicator.id);
  const assessment = useAssessment(indicator.id);
  const series = useMemo(() => aggregateSeries(readings, range, window), [readings, range, window]);
  const ageMin = useAgeMin(series.last?.takenAt);
  const name = translate(indicator.name);
  const lastValue = typeof series.last?.value === 'number' ? series.last.value : undefined;

  // A day window starts and ends at the same clock time: show the weekday too.
  const formatTime = (ms: number) =>
    range === 'day'
      ? new Date(ms).toLocaleString(language, {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date(ms).toLocaleDateString(language, { day: 'numeric', month: 'short' });

  const bandLine = [
    baseline
      ? format(t.bandLine, {
          low: formatNumber(baseline.range[0]),
          high: formatNumber(baseline.range[1]),
        })
      : t.noBaseline,
    series.count > 0 ? format(t.readingsInRange, { n: series.count }) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  const [scrub, setScrub] = useState<[number, number] | null>(null);
  const level = assessment?.level ?? 'pending';
  const heroValue = scrub
    ? formatNumber(scrub[1])
    : lastValue === undefined
      ? '—'
      : formatNumber(lastValue);

  return (
    <View className="gap-5">
      {/* Hero (WHOOP trend): 44 pt figure that follows the scrub, one-word status. */}
      <View className="gap-1.5">
        <View className="flex-row items-baseline gap-2" accessibilityLiveRegion="polite">
          <Text className="text-metric font-semibold tabular-nums">{heroValue}</Text>
          <Text className="text-muted-foreground text-title-sm">{unitText(indicator.unit)}</Text>
        </View>
        {scrub ? (
          <Text className="text-muted-foreground text-body-sm tabular-nums">
            {new Date(scrub[0]).toLocaleString(language, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        ) : (
          <View className="flex-row items-center gap-2">
            <LevelSymbol level={level} size={10} />
            <Text
              className={cn(
                'text-body-sm font-semibold',
                level === 'pending' ? 'text-muted-foreground' : LEVEL_TEXT_CLASS[level],
              )}
            >
              {levelLabel(h, level)}
            </Text>
            <Text className="text-tertiary text-caption tabular-nums" numberOfLines={1}>
              {bandLine}
            </Text>
          </View>
        )}
      </View>

      {controls}

      <SeriesChart
        data={series.data}
        baseline={baseline}
        events={events}
        height={200}
        unit={indicator.unit}
        lastLevel={assessment?.level}
        referenceRange={rules.green}
        // Per-point level from the config rules (environment-adjusted): red readings show red.
        levelAt={(_, v) => pointLevel(rules, v)}
        bucketMs={range === 'day' ? 0 : 86_400_000}
        timeDomain={window}
        formatTime={formatTime}
        formatValue={formatNumber}
        onScrub={setScrub}
        className="-mx-4"
      />

      <DataLabel source={series.last?.source} ageMin={series.last ? ageMin : undefined} />

      <Button
        variant="ghost"
        accessibilityRole="button"
        accessibilityLabel={format(t.openIndicator, { name })}
        onPress={() => router.push({ pathname: '/indicator/[id]', params: { id: indicator.id } })}
        className="border-border active:bg-active min-h-row h-auto justify-start gap-3 rounded-lg border px-4 py-0 sm:h-auto"
      >
        <Text className="text-body-sm flex-1 font-medium">{t.openDetails}</Text>
        <Icon as={ChevronRight} size={16} className="text-tertiary group-active:text-tertiary" />
      </Button>
    </View>
  );
}
