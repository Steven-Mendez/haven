import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: Props) {
  return (
    <View className={cn('items-center gap-3 px-6 py-8', className)}>
      {icon ? (
        <Icon as={icon} size={20} strokeWidth={1.75} className="text-muted-foreground" />
      ) : null}
      <View className="items-center gap-1">
        <Text role="heading" className="text-title-sm text-center font-semibold">
          {title}
        </Text>
        {description ? (
          <Text className="text-muted-foreground text-body-sm text-center">{description}</Text>
        ) : null}
      </View>
      {action || secondaryAction ? (
        <View className="items-center gap-1 pt-1">
          {action ? (
            <Button
              accessibilityRole="button"
              onPress={action.onPress}
              className="min-h-touch h-auto rounded-full px-5 py-0 sm:h-auto"
            >
              <Text className="text-primary-foreground text-body-sm font-semibold">
                {action.label}
              </Text>
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button
              variant="link"
              accessibilityRole="button"
              onPress={secondaryAction.onPress}
              className="min-h-touch h-auto rounded-none px-4 py-0 sm:h-auto"
            >
              <Text className="text-link text-body-sm font-medium">{secondaryAction.label}</Text>
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
