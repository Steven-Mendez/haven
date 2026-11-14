import * as Haptics from 'expo-haptics';
import { Platform, View } from 'react-native';

import { Text } from '@/shared/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { cn } from '@/shared/lib/utils';

type Option<T extends string> = { value: T; label: string; accessibilityLabel?: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  className?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  className,
}: Props<T>) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (!v || v === value) return;
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onChange(v as T);
      }}
      accessibilityLabel={accessibilityLabel}
      className={cn('border-border h-8 gap-0.5 rounded-md border p-0.5', className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            hitSlop={{ top: 8, bottom: 8 }}
            className={cn(
              'h-[26px] min-w-0 flex-1 rounded-sm px-2',
              selected ? 'bg-muted' : 'bg-transparent',
            )}
          >
            <Text
              className={cn(
                'text-caption font-medium tabular-nums',
                selected ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {o.label}
            </Text>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

export function SegmentedProgress({
  total,
  current,
  className,
}: {
  total: number;
  current: number;
  className?: string;
}) {
  return (
    <View aria-hidden className={cn('flex-row gap-1', className)}>
      {Array.from({ length: Math.max(1, total) }, (_, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed number of steps
          key={i}
          className={cn(
            'h-[3px] flex-1 rounded-full',
            i < current ? 'bg-brand' : i === current ? 'bg-foreground' : 'bg-muted',
          )}
        />
      ))}
    </View>
  );
}
