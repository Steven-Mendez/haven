import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Spinner } from '@/shared/components/ui/spinner';
import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';

type Variant = 'primary' | 'secondary' | 'destructive' | 'emergency' | 'outline' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'md' | 'lg';
  icon?: LucideIcon;
  detail?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  className?: string;
};

const RNR_VARIANT = {
  primary: 'default',
  secondary: 'secondary',
  destructive: 'destructive',
  emergency: 'destructive',
  outline: 'outline',
  ghost: 'ghost',
} as const;

const DESTRUCTIVE = 'bg-destructive dark:bg-destructive active:opacity-85';
const EXTRA: Record<Variant, string> = {
  primary: 'active:opacity-85',
  secondary: 'bg-transparent border border-border-strong active:bg-active',
  destructive: DESTRUCTIVE,
  emergency: DESTRUCTIVE,
  outline: 'border border-border-strong bg-transparent dark:bg-transparent',
  ghost: 'bg-transparent active:bg-active',
};

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
