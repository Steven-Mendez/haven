import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ActivityRings, type RingDatum, RingLegend, RingSpark } from '@/shared/components/haven';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';

// Building blocks of the Routine dashboard: tiles in a two-column grid,
// grouped by what they are for, plus the progress and streak tiles.

/** red and amber ask for attention; green is done; pending is neutral. */
export type TileState = 'red' | 'amber' | 'green' | 'pending';

const DOT: Record<TileState, string> = {
  red: 'bg-level-red',
  amber: 'bg-level-amber',
  green: 'bg-level-green',
  pending: 'border-muted-foreground border',
};

const TILE = 'border-border active:bg-active min-w-[46%] flex-1 rounded-lg border p-3';

export function Tile({
  icon,
  title,
  status,
  state,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  status: string;
  state: TileState;
  onPress: () => void;
}) {
  const attention = state === 'red' || state === 'amber';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${status}`}
      onPress={onPress}
      className={cn(
        TILE,
        'min-h-[104px] justify-between gap-3',
        attention && 'border-foreground/25',
      )}
    >
      <View className="flex-row items-start justify-between">
        <View className="bg-muted h-9 w-9 items-center justify-center rounded-md">
          <Icon as={icon} size={18} className="text-foreground" />
        </View>
        <View className={cn('mt-1 h-2.5 w-2.5 rounded-full', DOT[state])} />
      </View>
      <View className="gap-0.5">
        <Text className="text-body-sm font-semibold" numberOfLines={1}>
          {title}
        </Text>
        <Text
          className={cn('text-caption', attention ? 'text-foreground' : 'text-muted-foreground')}
          numberOfLines={2}
        >
          {status}
        </Text>
      </View>
    </Pressable>
  );
}

/** A titled two-column grid; an odd last tile takes the full width. */
export function TileGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text
        role="heading"
        aria-level="2"
        className="text-muted-foreground text-caption font-semibold tracking-wider uppercase"
      >
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-3">{children}</View>
    </View>
  );
}

export function ProgressTile({
  title,
  rings,
  done,
  total,
  hint,
  accessibilityLabel,
  onPress,
}: {
  title: string;
  rings: RingDatum[];
  done: number;
  total: number;
  hint: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      className={cn(TILE, 'gap-3')}
    >
      <Text className="text-muted-foreground text-caption font-semibold tracking-wider uppercase">
        {title}
      </Text>
      <View className="items-center">
        <ActivityRings rings={rings} size={96} accessibilityLabel={accessibilityLabel}>
          <Text className="text-body font-bold tabular-nums">{`${done}/${total}`}</Text>
        </ActivityRings>
      </View>
      <RingLegend rings={rings} />
    </Pressable>
  );
}

export function StreakTile({
  title,
  streak,
  unit,
  best,
  week,
  hint,
  onPress,
}: {
  title: string;
  streak: number;
  unit: string;
  best: string;
  week: { date: string; label: string; complete: boolean; today: boolean }[];
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      className={cn(TILE, 'justify-between gap-3')}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground text-caption font-semibold tracking-wider uppercase">
          {title}
        </Text>
        <Icon as={ChevronRight} size={16} className="text-tertiary -mr-1" />
      </View>
      <View className="gap-1">
        <View className="flex-row items-baseline gap-2">
          <RingSpark size={20} />
          <Text className="text-metric font-bold tabular-nums">{streak}</Text>
        </View>
        <Text className="text-muted-foreground text-body-sm">{unit}</Text>
        <Text className="text-tertiary text-caption tabular-nums">{best}</Text>
      </View>
      <View className="flex-row justify-between">
        {week.map((d) => (
          <View key={d.date} accessible accessibilityLabel={d.label} className="items-center gap-1">
            <View
              className={cn(
                'h-3 w-3 rounded-full',
                d.complete ? 'bg-brand' : 'border-border border',
                d.today && 'border-foreground border-[1.5px]',
              )}
            />
            <Text
              className={cn(
                'text-[10px] leading-[12px]',
                d.today ? 'text-foreground font-bold' : 'text-tertiary',
              )}
            >
              {d.label}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}
