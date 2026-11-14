import { Check } from 'lucide-react-native';
import { Fragment } from 'react';
import { View } from 'react-native';

import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';

import { havenTexts } from './i18n';

export type ScaleValue = 1 | 2 | 3 | 4 | 5;

type Props = {
  value?: ScaleValue | null;
  onChange: (value: ScaleValue) => void;
  kind: 'mood' | 'stress';
  title?: string;
  labels?: [string, string, string, string, string];
  echo?: boolean;
  disabled?: boolean;
  className?: string;
};

const VALUES: ScaleValue[] = [1, 2, 3, 4, 5];

export function ScaleInput({
  value,
  onChange,
  kind,
  title,
  labels,
  echo = true,
  disabled,
  className,
}: Props) {
  const t = useTexts(havenTexts);
  const names =
    labels ??
    (kind === 'mood'
      ? [t.mood1, t.mood2, t.mood3, t.mood4, t.mood5]
      : [t.stress1, t.stress2, t.stress3, t.stress4, t.stress5]);
  const order = kind === 'mood' ? [...VALUES].reverse() : VALUES;

  return (
    <View className={cn('gap-4', className)}>
      {title ? (
        <Text role="heading" className="text-title font-bold">
          {title}
        </Text>
      ) : null}
      {echo ? (
        <View
          className="flex-row items-baseline gap-3"
          accessibilityLiveRegion="polite"
          accessible
          accessibilityLabel={value ? `${value}, ${names[value - 1]}` : t.pickValue}
        >
          <Text
            className={cn(
              'text-metric-xl font-semibold tabular-nums',
              value ? 'text-foreground' : 'text-disabled',
            )}
          >
            {value ?? '–'}
          </Text>
          <Text
            className={cn('text-body', value ? 'text-muted-foreground' : 'text-tertiary')}
            numberOfLines={1}
          >
            {value ? names[value - 1] : t.pickValue}
          </Text>
        </View>
      ) : null}
      <ToggleGroup
        type="single"
        value={value ? String(value) : undefined}
        onValueChange={(next) => {
          const v = next ? (Number(next) as ScaleValue) : value;
          if (v) onChange(v);
        }}
        disabled={disabled}
        accessibilityRole="radiogroup"
        className="border-border flex-col items-stretch rounded-lg border"
      >
        {order.map((v, i) => {
          const selected = value === v;
          return (
            <Fragment key={v}>
              {i > 0 ? <View className="bg-border ml-4 h-px" /> : null}
              <ToggleGroupItem
                value={String(v)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled }}
                accessibilityLabel={`${v}, ${names[v - 1]}`}
                className={cn(
                  'min-h-row h-auto min-w-0 flex-row items-center justify-start gap-4 rounded-none px-4 sm:h-auto sm:min-w-0 sm:px-4',
                  selected ? 'bg-brand-subtle active:bg-brand-subtle' : 'active:bg-active',
                  i === 0 && 'rounded-t-lg',
                  i === order.length - 1 && 'rounded-b-lg',
                )}
              >
                <Text
                  className={cn(
                    'text-body-sm w-4 font-semibold tabular-nums',
                    selected ? 'text-brand' : 'text-tertiary',
                  )}
                >
                  {v}
                </Text>
                <Text
                  className={cn(
                    'text-body-sm flex-1',
                    selected ? 'text-foreground font-medium' : 'text-foreground font-normal',
                  )}
                >
                  {names[v - 1]}
                </Text>
                {selected ? (
                  <Icon as={Check} size={18} strokeWidth={2} className="text-brand" />
                ) : null}
              </ToggleGroupItem>
            </Fragment>
          );
        })}
      </ToggleGroup>
    </View>
  );
}
