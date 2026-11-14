import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Spinner } from '@/shared/components/ui/spinner';
import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';

/** `emergency` is a deprecated alias of `destructive`. */
type Variant = 'primary' | 'secondary' | 'destructive' | 'emergency' | 'outline' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  /** primary: the one main action (light on dark) · destructive: SOS-level actions only
   *  ("Open protocol") · secondary: elevated surface + border · outline · ghost: tertiary.
   *  Inside the emergency flow the main action is `primary`, not red. */
  variant?: Variant;
  /** md = 52 pt · lg = 60 pt (emergency steps, "Done", "Start"). */
  size?: 'md' | 'lg';
  icon?: LucideIcon;
  /** Second line under the label (e.g. "< 4 min"). */
  detail?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Full width by default. */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  className?: string;
};

/** RNR `Button` variant used for each HAVEN variant. */
const RNR_VARIANT = {
  primary: 'default',
  secondary: 'secondary',
  destructive: 'destructive',
  emergency: 'destructive',
  outline: 'outline',
  ghost: 'ghost',
} as const;

/** Extra classes on top of RNR's variants. */
const DESTRUCTIVE = 'bg-destructive dark:bg-destructive active:opacity-85';
const EXTRA: Record<Variant, string> = {
  primary: 'active:opacity-85',
  secondary: 'bg-transparent border border-border-strong active:bg-active',
  // RNR's destructive is 60 % opaque in dark mode: too weak for an emergency.
  destructive: DESTRUCTIVE,
  emergency: DESTRUCTIVE,
  outline: 'border border-border-strong bg-transparent dark:bg-transparent',
  ghost: 'bg-transparent active:bg-active',
};

/**
 * RNR `Button` as a pill (SPEC.md §4, X / Grok): 52 pt (60 lg), label 17/600, no shadow. Primary =
 * white fill with black text; secondary = hairline outline. One primary per screen.
 */
export function BigButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  detail,
  disabled = false,
  loading = false,
  fullWidth = true,
  accessibilityLabel,
  accessibilityHint,
  className,
}: Props) {
  const inactive = disabled || loading;
  return (
    <Button
      variant={RNR_VARIANT[variant]}
      size="lg"
      accessibilityLabel={accessibilityLabel ?? (detail ? `${label}, ${detail}` : label)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      className={cn(
        'h-auto gap-2 rounded-full px-6 py-2.5 shadow-none',
        size === 'lg' ? 'min-h-touch-lg' : 'min-h-button',
        fullWidth ? 'self-stretch' : 'self-start',
        EXTRA[variant],
        // A disabled primary must not look enabled: muted fill, disabled text, no dimmed white.
        inactive && !loading && variant === 'primary' && 'bg-muted opacity-100',
        className,
      )}
    >
      {loading ? (
        <Spinner size={20} />
      ) : icon ? (
        <Icon as={icon} size={20} strokeWidth={1.75} />
      ) : null}
      <View className="items-center">
        <Text
          className={cn(
            'text-body font-semibold',
            inactive && !loading && variant === 'primary' && 'text-disabled',
          )}
        >
          {label}
        </Text>
        {detail ? <Text className="text-caption opacity-75">{detail}</Text> : null}
      </View>
    </Button>
  );
}
