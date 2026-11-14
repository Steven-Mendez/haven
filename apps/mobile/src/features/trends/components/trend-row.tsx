import type { Indicator, Level } from '@haven/core';
import { ChevronRight } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';
import {
  ageText,
  havenTexts,
  LevelMeter,
  levelLabel,
  Sparkline,
  useUnitLabel,
  zoneIcon,
} from '@/shared/components/haven';
import { indicatorContext } from '@/shared/components/info-sheet';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text, TextClassContext } from '@/shared/components/ui/text';
import { useAgeMin, useReadings } from '@/shared/data';
import { useTexts, useTranslate } from '@/shared/i18n';
import { useLayout } from '@/shared/lib/layout';
import { cn } from '@/shared/lib/utils';
import { aggregateSeries, rangeWindow } from '../logic/series';

const formatNumber = (v: number) => String(Math.round(v * 10) / 10);

/**
 * One indicator row (WHOOP / X): zone icon · name (one line) + age · last-week sparkline (grey,
 * coloured only when out of range) · 3-segment level meter · 22 pt value · chevron.
 */
export function TrendRow({
  indicator,
  level,
  now,
  onPress,
  grouped = false,
}: {
  indicator: Indicator;
  level: Level;
  now: number;
  onPress: () => void;
  /** Under a zone header: no zone icon, and the name gets two lines instead of being cut. */
  grouped?: boolean;
}) {
  const t = useTexts(havenTexts);
  const unitText = useUnitLabel();
  const translate = useTranslate();
  // Below Pro Max width a shorter sparkline and tighter gaps keep long names on one line.
  const { compact } = useLayout();
  const readings = useReadings(indicator.id);
  const week = useMemo(
    () => aggregateSeries(readings, 'week', rangeWindow('week', now), 6 * 3_600_000),
    [readings, now],
  );
  const last = readings[readings.length - 1];
  const ageMin = useAgeMin(last?.takenAt);
  const value = typeof last?.value === 'number' ? formatNumber(last.value) : '—';
  const name = translate(indicator.name);

  return (
    <Button
      variant="ghost"
      onPress={onPress}
      onLongPress={() =>
        indicatorContext(indicator.id, level, [{ label: t.openDetails, onPress: onPress }])
      }
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${value} ${unitText(indicator.unit)}, ${levelLabel(t, level)}, ${ageText(t, ageMin)}`}
      className={cn(
        'min-h-row-indicator active:bg-active h-auto justify-start rounded-none px-4 py-2 sm:h-auto',
        compact ? 'gap-2' : 'gap-3',
      )}
    >
      {grouped ? null : (
        <Icon
          as={zoneIcon(indicator.zone)}
          size={20}
          strokeWidth={1.75}
          className="text-muted-foreground group-active:text-muted-foreground"
        />
      )}
      <View className="flex-1 gap-0.5">
        <Text className="text-body-sm font-medium" numberOfLines={grouped ? 2 : 1}>
          {name}
        </Text>
        <Text
          className="text-tertiary text-caption group-active:text-tertiary font-normal tabular-nums"
          numberOfLines={1}
        >
          {ageText(t, last ? ageMin : undefined)}
        </Text>
      </View>
      {/* Sparkline styles its own labels: keep them out of the Button's text classes. */}
      <TextClassContext.Provider value={undefined}>
        <Sparkline data={week.data} level={level} width={compact ? 44 : 56} />
      </TextClassContext.Provider>
      <View className="min-w-16 items-end gap-1">
        <Text className="text-title font-bold tabular-nums" numberOfLines={1}>
          {value}
          <Text className="text-muted-foreground text-caption group-active:text-muted-foreground font-normal">{` ${unitText(indicator.unit)}`}</Text>
        </Text>
        <LevelMeter level={level} />
      </View>
      <Icon
        as={ChevronRight}
        size={16}
        className="text-tertiary group-active:text-tertiary -mr-1"
      />
    </Button>
  );
}
