import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SegmentedProgress } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { MONO_FONT } from '@/shared/lib/theme';

export const clock = (): number => globalThis.performance?.now?.() ?? Date.now();

type Props = {
  label: string;
  progress: number;
  exitLabel: string;
  onExit: () => void;
  children: ReactNode;
};

const SEGMENTS = 10;

export function TestFrame({ label, progress, exitLabel, onExit, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="bg-background flex-1"
      style={{ paddingTop: insets.top + 4, paddingBottom: insets.bottom + 8 }}
    >
      <View className="flex-row items-center gap-3 px-4">
        <Button
          variant="outline"
          accessibilityRole="button"
          accessibilityLabel={exitLabel}
          onPress={onExit}
          className="min-h-touch min-w-touch border-border h-auto rounded-full p-0 active:bg-transparent active:opacity-70 sm:h-auto"
        >
          <Icon as={X} size={18} className="text-foreground group-active:text-foreground" />
        </Button>
        <Text
          className="text-muted-foreground text-mono flex-1 text-right tabular-nums"
          style={{ fontFamily: MONO_FONT }}
          accessibilityLiveRegion="polite"
        >
          {label}
        </Text>
      </View>
      <SegmentedProgress
        total={SEGMENTS}
        current={Math.min(SEGMENTS, Math.floor(progress * SEGMENTS))}
        className="mt-4 px-4"
      />
      <View className="flex-1">{children}</View>
    </View>
  );
}
