import type { ReadingSource } from '@haven/core';
import {
  Bluetooth,
  CircleHelp,
  Clock,
  Database,
  Hand,
  type LucideIcon,
  PencilLine,
  Satellite,
  Smartphone,
  Watch,
} from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';

import { ageText, type HavenTexts, havenTexts } from './i18n';

const SOURCE_ICON: Record<ReadingSource, LucideIcon> = {
  watch: Watch,
  healthkit: Smartphone,
  healthconnect: Smartphone,
  ble: Bluetooth,
  manual: PencilLine,
  screen: Hand,
  simulator: Database,
  ship: Satellite,
  phone: Smartphone,
};

export function sourceLabel(t: HavenTexts, source: ReadingSource | (string & {})): string {
  const labels: Record<ReadingSource, string> = {
    watch: t.sourceWatch,
    healthkit: t.sourceHealthkit,
    healthconnect: t.sourceHealthconnect,
    ble: t.sourceBle,
    manual: t.sourceManual,
    screen: t.sourceScreen,
    simulator: t.sourceRecord,
    ship: t.sourceShip,
    phone: t.sourcePhone,
  };
  return labels[source as ReadingSource] ?? source;
}

type Props = {
  source?: ReadingSource | (string & {});
  ageMin?: number;
  simulated?: boolean;
  stale?: boolean;
  onPressOrigin?: () => void;
  className?: string;
};

export function DataLabel({ source, ageMin, stale, onPressOrigin, className }: Props) {
  const t = useTexts(havenTexts);
  const SourceIcon = source ? (SOURCE_ICON[source as ReadingSource] ?? CircleHelp) : CircleHelp;
  const parts = [source ? sourceLabel(t, source) : undefined, ageText(t, ageMin)].filter(Boolean);
  const tone = stale ? 'text-foreground' : 'text-muted-foreground';

  return (
    <View className={cn('gap-0.5', className)}>
      <View
        accessible
        accessibilityLabel={parts.join(', ')}
        className="flex-row flex-wrap items-center gap-x-1.5 gap-y-1"
      >
        <Icon as={stale ? Clock : SourceIcon} size={14} strokeWidth={2} className={tone} />
        <Text className={cn('text-caption tabular-nums', tone)}>{parts.join(' · ')}</Text>
      </View>
      {onPressOrigin ? <OriginLink onPress={onPressOrigin} /> : null}
    </View>
  );
}

export function OriginLink({ onPress, className }: { onPress: () => void; className?: string }) {
  const t = useTexts(havenTexts);
  return (
    <Button
      variant="link"
      role="link"
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={8}
      className={cn('min-h-touch h-auto gap-1.5 self-start px-0', className)}
    >
      <Icon as={CircleHelp} size={16} strokeWidth={2} className="text-link" />
      <Text className="text-link text-footnote font-medium">{t.whereFrom}</Text>
    </Button>
  );
}
