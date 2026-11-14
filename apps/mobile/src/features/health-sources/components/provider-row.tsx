import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';

type Props = {
  name: string;
  /** Optional gray line (last sync). Descriptions go in a note under the group. */
  subtitle?: string;
  /** Spoken extra (the reason it is unavailable). */
  accessibilityHint?: string;
  /** Short state label ("Connected", "Not available"…). Neutral: a missing source is not an alert. */
  state: string;
  connected: boolean;
  /** One action instead of the badge ("Grant permission"). */
  action?: { label: string; onPress: () => void };
  /** Control instead of the badge (a Switch). */
  control?: ReactNode;
};

/** One provider per row: name · state, action or control on the right. */
export function ProviderRow({
  name,
  subtitle,
  state,
  connected,
  action,
  control,
  accessibilityHint,
}: Props) {
  return (
    <View
      className="min-h-row-settings flex-row items-center gap-3 px-4 py-2.5"
      accessible={!action && !control}
      accessibilityLabel={[name, state, subtitle].filter(Boolean).join('. ')}
      accessibilityHint={accessibilityHint}
    >
      <View className="flex-1 justify-center gap-0.5">
        <Text className="text-body-sm font-medium" numberOfLines={2}>
          {name}
        </Text>
        {subtitle ? (
          <Text className="text-tertiary text-caption" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {control ??
        (action ? (
          <Button
            variant="default"
            className="min-h-touch h-auto rounded-full px-4"
            onPress={action.onPress}
          >
            <Text className="text-body-sm font-semibold">{action.label}</Text>
          </Button>
        ) : (
          // Status word + dot (Starlink): neutral, a missing source is not an alert.
          <View className="flex-row items-center gap-1.5">
            <View
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                connected ? 'bg-level-green' : 'border-muted-foreground border',
              )}
            />
            <Text
              className={cn(
                'text-caption',
                connected ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {state}
            </Text>
          </View>
        ))}
    </View>
  );
}
