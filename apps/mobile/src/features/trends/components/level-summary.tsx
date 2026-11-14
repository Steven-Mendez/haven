import type { Level } from '@haven/core';
import { View } from 'react-native';
import { havenTexts, LevelSymbol, levelLabel } from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { LEVEL_ORDER, type LevelCounts } from '../logic/groups';

const BAR: Record<Level, string> = {
  red: 'bg-level-red',
  amber: 'bg-level-amber',
  green: 'bg-level-green',
  pending: 'bg-level-pending',
};

/**
 * Level summary above the list (Superpower «Biomarkers»): total, one bar split by level and a
 * count per level with its symbol, so colour is never the only cue.
 */
export function LevelSummary({ counts, title }: { counts: LevelCounts; title: string }) {
  const h = useTexts(havenTexts);
  const shown = LEVEL_ORDER.filter((level) => counts[level] > 0);
  return (
    <View
      className="border-border gap-3 rounded-lg border p-4"
      accessible
      accessibilityLabel={`${title}: ${shown.map((l) => `${counts[l]} ${levelLabel(h, l)}`).join(', ')}`}
    >
      <Text className="text-body-sm font-semibold">{title}</Text>
      <View className="h-2 flex-row gap-0.5 overflow-hidden rounded-full">
        {shown.map((level) => (
          <View key={level} className={cn('h-2', BAR[level])} style={{ flex: counts[level] }} />
        ))}
      </View>
      <View className="flex-row flex-wrap gap-x-5 gap-y-2">
        {shown.map((level) => (
          <View key={level} className="flex-row items-center gap-1.5">
            <LevelSymbol level={level} size={14} />
            <Text className="text-body-sm font-semibold tabular-nums">{counts[level]}</Text>
            <Text className="text-muted-foreground text-caption">{levelLabel(h, level)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
