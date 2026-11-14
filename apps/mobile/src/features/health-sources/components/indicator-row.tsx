import type { Level, Reading } from '@haven/core';
import { ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';
import { LevelBadge } from '@/shared/components/haven';
import { ReadingSource } from '@/shared/components/reading-source';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text, TextClassContext } from '@/shared/components/ui/text';

type Props = {
  name: string;
  level: Level;
  latest: Reading | undefined;
  pendingReason?: string;
  onPress: () => void;
};

export function IndicatorRow({ name, level, latest, pendingReason, onPress }: Props) {
  return (
    <Button
      variant="ghost"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={pendingReason ? `${name}. ${pendingReason}` : name}
      className="min-h-row active:bg-active h-auto justify-start gap-3 rounded-none px-4 py-2 sm:h-auto"
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-body-sm font-medium" numberOfLines={1}>
          {name}
        </Text>
        {pendingReason ? (
          <Text className="text-tertiary text-caption group-active:text-tertiary font-normal">
            {pendingReason}
          </Text>
        ) : (
          <TextClassContext.Provider value={undefined}>
            <ReadingSource reading={latest} />
          </TextClassContext.Provider>
        )}
      </View>
      <LevelBadge level={level} size="sm" />
      <Icon as={ChevronRight} size={16} className="text-tertiary group-active:text-tertiary" />
    </Button>
  );
}
