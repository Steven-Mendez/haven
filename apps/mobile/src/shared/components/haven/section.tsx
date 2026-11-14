import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';

type SectionProps = {
  title?: string;
  count?: number;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  className?: string;
};

export function Section({ title, count, action, children, className }: SectionProps) {
  return (
    <View className={cn('gap-2', className)}>
      {title || action ? (
        <View className="min-h-touch flex-row items-end justify-between gap-3 pb-1">
          {title ? (
            <Text
              role="heading"
              aria-level="2"
              accessibilityLabel={count !== undefined ? `${title}, ${count}` : title}
              className="text-muted-foreground text-micro flex-1 font-semibold uppercase"
            >
              {title}
              {count !== undefined ? (
                <Text className="text-tertiary text-micro font-semibold tabular-nums">
                  {`  ${count}`}
                </Text>
              ) : null}
            </Text>
          ) : (
            <View />
          )}
          {action ? (
            <Button
              variant="link"
              onPress={action.onPress}
              hitSlop={12}
              className="h-auto min-h-0 px-0 py-0"
            >
              <Text className="text-link text-caption font-medium">{action.label}</Text>
            </Button>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

type HeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  right?: ReactNode;
  size?: 'large' | 'title';
  className?: string;
};

export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  right,
  size = 'large',
  className,
}: HeaderProps) {
  return (
    <View className={cn('flex-row items-start gap-3', className)}>
      <View className="flex-1 gap-1">
        {eyebrow ? (
          <Text className="text-muted-foreground text-micro font-semibold uppercase">
            {eyebrow}
          </Text>
        ) : null}
        <Text
          role="heading"
          aria-level="1"
          className={cn('font-bold', size === 'large' ? 'text-display' : 'text-title')}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-muted-foreground text-body-sm tabular-nums">{subtitle}</Text>
        ) : null}
      </View>
      {right ? <View className="pt-1.5">{right}</View> : null}
    </View>
  );
}
