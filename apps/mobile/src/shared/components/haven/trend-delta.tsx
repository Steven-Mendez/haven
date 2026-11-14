import { ArrowDown, ArrowUp, Equal } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { useLanguage, useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';

import { format, formatMetric, havenTexts } from './i18n';

type TrendDeltaProps = {
  /** Current value. Nothing is rendered without a numeric value or a baseline. */
  value?: number | string;
  /** Personal baseline (`Assessment.baseline`). */
  baseline?: { median: number; range: [number, number] };
  /** Number formatting for the delta and the median (decimals). */
  formatValue?: (value: number) => string;
  className?: string;
};

/**
 * Delta against the personal baseline (DESIGN_SYSTEM.md §3.1): "↑ 14 above your baseline (78)",
 * "↓ 3 below your baseline (78)" or "Within your usual range". Always neutral grey: the level
 * badge carries the severity, never the delta.
 */
export function TrendDelta({ value, baseline, formatValue, className }: TrendDeltaProps) {
  const t = useTexts(havenTexts);
  const language = useLanguage();
  const fmt = formatValue ?? ((v: number) => formatMetric(v, language));
  if (typeof value !== 'number' || !Number.isFinite(value) || !baseline) return null;

  const [low, high] = baseline.range;
  const within = value >= low && value <= high;
  const diff = value - baseline.median;
  const b = fmt(baseline.median);
  const text = within
    ? t.deltaWithin
    : format(diff > 0 ? t.deltaAbove : t.deltaBelow, { n: fmt(Math.abs(diff)), b });
  const icon = within ? Equal : diff > 0 ? ArrowUp : ArrowDown;

  return (
    <View
      accessible
      accessibilityLabel={text}
      className={cn('flex-row items-center gap-1', className)}
    >
      <Icon as={icon} size={14} strokeWidth={2} className="text-muted-foreground" />
      <Text className="text-muted-foreground text-footnote tabular-nums">{text}</Text>
    </View>
  );
}
