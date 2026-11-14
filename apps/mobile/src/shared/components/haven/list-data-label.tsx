import type { ReadingSource } from '@haven/core';
import { Clock } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';

import { OriginLink, sourceLabel } from './data-label';
import { ageText, havenTexts } from './i18n';

type Props = {
  sources: (ReadingSource | (string & {}))[];
  ageMin?: number;
  simulated?: boolean | 'some';
  stale?: boolean;
  onPressOrigin?: () => void;
  className?: string;
};

export function ListDataLabel({ sources, ageMin, stale, onPressOrigin, className }: Props) {
  const t = useTexts(havenTexts);
  const names = [...new Set(sources.map((s) => sourceLabel(t, s)))];
  const joined =
    names.length <= 1
      ? (names[0] ?? '')
      : `${names.slice(0, -1).join(', ')} ${t.and} ${names.at(-1)}`;
  const parts = [joined || undefined, ageText(t, ageMin)].filter(Boolean) as string[];
  const tone = stale ? 'text-foreground' : 'text-muted-foreground';

  return (
    <View className={cn('flex-row flex-wrap items-center gap-x-1.5 gap-y-1', className)}>
      <View
        accessible
        accessibilityLabel={parts.join(', ')}
        className="flex-row flex-wrap items-center gap-1.5"
      >
        {stale ? <Icon as={Clock} size={14} strokeWidth={2} className={tone} /> : null}
        <Text className={cn('text-caption tabular-nums', tone)}>{parts.join(' · ')}</Text>
      </View>
      {onPressOrigin ? <OriginLink onPress={onPressOrigin} className="ml-auto" /> : null}
    </View>
  );
}
