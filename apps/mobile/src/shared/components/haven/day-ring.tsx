import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';

import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { type ThemeZone, useColors, ZONES } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

import { arcPath, clamp01 } from './geometry';
import { format, havenTexts } from './i18n';

type Segment = { zone: string; progress: number };

type Props = {
  segments: Segment[];
  size?: number;
  thickness?: number;
  children?: ReactNode;
  className?: string;
};

export function DayRing({ segments, size = 160, thickness, children, className }: Props) {
  const colors = useColors();
  const t = useTexts(havenTexts);
  const stroke = thickness ?? (size >= 120 ? 6 : size >= 80 ? 5 : 4);
  const r = (size - stroke) / 2;
  const c = size / 2;

  const progressOf = (zone: ThemeZone) =>
    clamp01(segments.find((s) => s.zone === zone)?.progress ?? 0);
  const done = ZONES.filter((z) => progressOf(z) >= 1).length;
  const fraction = ZONES.reduce((sum, z) => sum + progressOf(z), 0) / ZONES.length;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={format(t.ringSummary, { n: done, total: ZONES.length })}
      accessibilityValue={{ min: 0, max: ZONES.length, now: done }}
      className={cn('items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={c} cy={c} r={r} stroke={colors.ring.track} strokeWidth={stroke} fill="none" />
        {fraction >= 0.999 ? (
          <Circle cx={c} cy={c} r={r} stroke={colors.ring.done} strokeWidth={stroke} fill="none" />
        ) : fraction > 0 ? (
          <Path
            d={arcPath(c, c, r, 0, 360 * fraction)}
            stroke={colors.ring.done}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
      </Svg>
      {children ?? (
        <View className="items-center">
          <Text
            className={cn(
              'font-semibold tabular-nums',
              size >= 140 ? 'text-metric' : size >= 80 ? 'text-title' : 'text-caption',
            )}
          >
            {done}/{ZONES.length}
          </Text>
          {size >= 120 ? (
            <Text className="text-muted-foreground text-caption">{t.actions}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

type Day = { label: string; complete: boolean; today?: boolean };

export function WeekDots({ days, className }: { days: Day[]; className?: string }) {
  const t = useTexts(havenTexts);
  return (
    <View className={cn('flex-row justify-between gap-2', className)}>
      {days.map((d, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-day week
          key={i}
          accessible
          accessibilityLabel={`${d.label}: ${d.complete ? t.dayComplete : t.dayIncomplete}${d.today ? `, ${t.today}` : ''}`}
          className="min-w-6 items-center gap-1.5"
        >
          <Text
            className={cn(
              'text-caption',
              d.today ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
          >
            {d.label}
          </Text>
          <View className="h-3.5 w-3.5 items-center justify-center rounded-full">
            {d.today ? (
              <View className="border-foreground absolute h-3.5 w-3.5 rounded-full border-[1.5px]" />
            ) : null}
            <View
              className={cn(
                'h-2 w-2 rounded-full',
                d.complete ? 'bg-brand' : 'border-border-strong border bg-transparent',
              )}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
