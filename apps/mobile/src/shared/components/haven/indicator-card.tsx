import type { Level, ReadingSource } from '@haven/core';
import { ArrowDown, ArrowUp, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text, TextClassContext } from '@/shared/components/ui/text';
import { useLanguage, useTexts } from '@/shared/i18n';
import { useLayout } from '@/shared/lib/layout';
import { cn } from '@/shared/lib/utils';
import { ListGroup } from './action-row';
import { DataLabel, OriginLink, sourceLabel } from './data-label';
import { ageText, format, formatMetric, havenTexts } from './i18n';
import { LEVEL_TEXT_CLASS, levelLabel } from './level';
import { LevelBadge } from './level-badge';
import { LevelMeter } from './level-symbol';
import { TrendDelta } from './trend-delta';
import { useUnitLabel } from './unit-label';

type Props = {
  name: string;
  value?: number | string;
  unit?: string;
  level: Level;
  baseline?: { median: number; range: [number, number] };
  explanation?: string;
  source?: ReadingSource | (string & {});
  ageMin?: number;
  simulated?: boolean;
  stale?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressOrigin?: () => void;
  formatValue?: (value: number) => string;
  compact?: boolean;
  icon?: LucideIcon;
  variant?: 'card' | 'row';
  grouped?: boolean;
  className?: string;
};

const WRAPPER =
  'h-auto flex-col items-stretch justify-start gap-0 rounded-none px-0 py-0 sm:h-auto';

export function IndicatorCard({
  name,
  value,
  level,
  baseline,
  explanation,
  source,
  ageMin,
  stale,
  onPress,
  onLongPress,
  onPressOrigin,
  formatValue,
  compact = false,
  icon,
  variant = 'card',
  grouped = false,
  className,
  unit: unitId,
}: Props) {
  const t = useTexts(havenTexts);
  const language = useLanguage();
  const unitOf = useUnitLabel();
  const { compact: narrow } = useLayout();
  const unit = unitId ? unitOf(unitId) : unitId;
  const fmt = formatValue ?? ((v: number) => formatMetric(v, language));
  const hasValue = value !== undefined && value !== null && value !== '';
  const shown = !hasValue ? '—' : typeof value === 'number' ? fmt(value) : String(value);

  const a11y = [
    name,
    hasValue ? `${shown} ${unit ?? ''}`.trim() : t.noCurrentValue,
    `${t.level}: ${levelLabel(t, level)}`,
    baseline ? format(t.baselineShort, { b: fmt(baseline.median) }) : undefined,
    source ? sourceLabel(t, source) : undefined,
    ageText(t, ageMin),
  ]
    .filter(Boolean)
    .join(', ');

  if (variant === 'row' || compact) {
    const numeric = typeof value === 'number' && Number.isFinite(value);
    const outside =
      numeric && baseline ? value < baseline.range[0] || value > baseline.range[1] : false;
    const diff = numeric && baseline ? value - baseline.median : 0;
    const line = (
      <View
        className={cn(
          'min-h-row-indicator flex-row items-center px-4 py-2',
          narrow ? 'gap-2' : 'gap-3',
        )}
      >
        {icon ? (
          <Icon as={icon} size={20} strokeWidth={1.75} className="text-muted-foreground" />
        ) : null}
        <View className="flex-1 gap-0.5">
          <Text className="text-body-sm font-medium" numberOfLines={2}>
            {name}
          </Text>
          <Text className="text-tertiary text-caption tabular-nums" numberOfLines={1}>
            {level === 'pending' && !hasValue ? t.noCurrentValue : ageText(t, ageMin)}
          </Text>
        </View>
        <LevelMeter level={level} />
        <View className="min-w-16 items-end">
          <Text
            className={cn(
              'text-title font-bold tabular-nums',
              !hasValue && 'text-tertiary font-normal',
            )}
            numberOfLines={1}
          >
            {shown}
            {hasValue && unit ? (
              <Text className="text-muted-foreground text-caption font-normal">{` ${unit}`}</Text>
            ) : null}
          </Text>
          {baseline && numeric ? (
            <View className="flex-row items-center gap-0.5">
              {outside ? (
                <Icon
                  as={diff > 0 ? ArrowUp : ArrowDown}
                  size={11}
                  strokeWidth={2.25}
                  className={LEVEL_TEXT_CLASS[level]}
                />
              ) : null}
              <Text className="text-tertiary text-[11px] leading-[14px] tabular-nums">
                {format(t.baselineShort, { b: fmt(baseline.median) })}
              </Text>
            </View>
          ) : null}
        </View>
        {onPress ? <Icon as={ChevronRight} size={16} className="text-tertiary -mr-1" /> : null}
      </View>
    );
    const inner = onPress ? (
      <Button
        variant="ghost"
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityHint={t.openDetails}
        accessibilityActions={onLongPress ? [{ name: 'longpress' }] : undefined}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') onLongPress?.();
        }}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        className={WRAPPER}
      >
        <TextClassContext.Provider value={undefined}>{line}</TextClassContext.Provider>
      </Button>
    ) : (
      <View accessible accessibilityLabel={a11y}>
        {line}
      </View>
    );
    if (grouped) return <View className={className}>{inner}</View>;
    return <ListGroup className={className}>{inner}</ListGroup>;
  }

  const showExplanation = explanation && (level === 'amber' || level === 'red');

  const body = (
    <View className="gap-3 p-4">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="text-body-sm flex-1 font-medium" numberOfLines={2}>
          {name}
        </Text>
        <LevelBadge level={level} size="sm" />
      </View>

      <View className="gap-1">
        <Text
          className={cn(
            'text-metric font-semibold tabular-nums',
            !hasValue && 'text-muted-foreground',
          )}
        >
          {shown}
          {hasValue && unit ? (
            <Text className="text-muted-foreground text-[15px] font-normal tracking-normal">
              {` ${unit}`}
            </Text>
          ) : null}
        </Text>
        {hasValue ? (
          <TrendDelta value={value} baseline={baseline} formatValue={fmt} />
        ) : (
          <Text className="text-muted-foreground text-footnote">{t.noCurrentValue}</Text>
        )}
      </View>

      {showExplanation ? <Text className="text-body-sm">{explanation}</Text> : null}

      <DataLabel source={source} ageMin={ageMin} stale={stale} />
    </View>
  );

  return (
    <View className={cn('border-border rounded-lg border', className)}>
      {onPress ? (
        <Button
          variant="ghost"
          accessibilityRole="button"
          accessibilityLabel={a11y}
          accessibilityHint={t.openDetails}
          onPress={onPress}
          className={cn(WRAPPER, 'rounded-lg')}
        >
          <TextClassContext.Provider value={undefined}>{body}</TextClassContext.Provider>
        </Button>
      ) : (
        <View accessible accessibilityLabel={a11y}>
          {body}
        </View>
      )}
      {onPressOrigin ? <OriginLink onPress={onPressOrigin} className="-mt-2 px-4" /> : null}
    </View>
  );
}
