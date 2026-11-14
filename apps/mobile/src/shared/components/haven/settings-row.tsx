import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Switch } from '@/shared/components/ui/switch';
import { Text, TextClassContext } from '@/shared/components/ui/text';
import { MONO_FONT } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

type Props = {
  label: string;
  value?: string;
  hint?: string;
  icon?: LucideIcon;
  onPress?: () => void;
  chevron?: boolean;
  trailing?: ReactNode;
  destructive?: boolean;
  mono?: boolean;
  accessibilityLabel?: string;
  className?: string;
};

const ROW_BUTTON =
  'h-auto flex-col items-stretch justify-start gap-0 rounded-none px-0 py-0 sm:h-auto';

export function SettingsRow({
  label,
  value,
  hint,
  icon,
  onPress,
  chevron = true,
  trailing,
  destructive = false,
  mono = false,
  accessibilityLabel,
  className,
}: Props) {
  const body = (
    <View className={cn('min-h-row-settings flex-row items-center gap-3 px-4 py-2.5', className)}>
      {icon ? (
        <Icon
          as={icon}
          size={20}
          strokeWidth={1.75}
          className={destructive ? 'text-destructive' : 'text-muted-foreground'}
        />
      ) : null}
      <View className="flex-1 gap-0.5">
        <Text
          className={cn('text-body-sm', destructive && 'text-destructive font-medium')}
          numberOfLines={1}
        >
          {label}
        </Text>
        {hint ? (
          <Text className="text-tertiary text-caption" numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (value ? (
          <Text
            className={cn(
              'text-muted-foreground text-body-sm max-w-[55%] text-right tabular-nums',
              mono && 'text-mono',
            )}
            style={mono ? { fontFamily: MONO_FONT } : undefined}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null)}
      {onPress && chevron && !trailing ? (
        <Icon as={ChevronRight} size={18} className="text-tertiary -mr-1" />
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View
        accessible={!trailing}
        accessibilityLabel={accessibilityLabel ?? [label, value].filter(Boolean).join(', ')}
      >
        {body}
      </View>
    );
  }
  return (
    <Button
      variant="ghost"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [label, value].filter(Boolean).join(', ')}
      className={ROW_BUTTON}
    >
      <TextClassContext.Provider value={undefined}>{body}</TextClassContext.Provider>
    </Button>
  );
}

export function SettingsSwitchRow({
  label,
  hint,
  icon,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  icon?: LucideIcon;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Button
      variant="ghost"
      role="switch"
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => onChange(!value)}
      className={ROW_BUTTON}
    >
      <TextClassContext.Provider value={undefined}>
        <SettingsRow
          label={label}
          hint={hint}
          icon={icon}
          trailing={
            <Switch checked={value} onCheckedChange={onChange} accessibilityElementsHidden />
          }
        />
      </TextClassContext.Provider>
    </Button>
  );
}
