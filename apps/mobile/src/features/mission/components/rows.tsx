import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Children, createContext, Fragment, type ReactNode, useContext } from 'react';
import { View } from 'react-native';
import { ScreenHeader } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';

/** Title of the open detail view: a group with the same title does not repeat its heading. */
const DetailTitle = createContext<string | undefined>(undefined);

/**
 * Settings group (DESIGN_SYSTEM §3.5 and §8.9, X / Apple Health style): sentence-case heading above
 * the card, rows split by `Separator`, and the optional grey `hint` as a note **under** the card.
 */
export function Group({
  title,
  hint,
  children,
  onLayout,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  onLayout?: (y: number) => void;
}) {
  const rows = Children.toArray(children).filter(Boolean);
  const repeated = useContext(DetailTitle) === title;
  return (
    <View className="gap-2" onLayout={(e) => onLayout?.(e.nativeEvent.layout.y)}>
      {repeated ? null : (
        <Text
          role="heading"
          aria-level="2"
          className="text-muted-foreground text-micro px-1 font-semibold uppercase"
        >
          {title}
        </Text>
      )}
      <View className="border-border overflow-hidden rounded-lg border">
        {rows.map((row, i) => (
          <Fragment key={(row as { key?: string }).key ?? i}>
            {i > 0 ? <View className="bg-border ml-4 h-px" /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {hint && !repeated ? <Text className="text-tertiary text-caption px-1">{hint}</Text> : null}
    </View>
  );
}

/** One-line row that opens another view: title on the left, value on the right, chevron. */
export function LinkRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[label, value].filter(Boolean).join('. ')}
      className="active:bg-active min-h-row-settings h-auto justify-start gap-3 rounded-none px-4 py-2.5 sm:h-auto"
    >
      <Text className="text-body-sm font-medium" numberOfLines={1}>
        {label}
      </Text>
      <Text
        className="text-body-sm text-muted-foreground group-active:text-muted-foreground flex-1 text-right font-normal tabular-nums"
        numberOfLines={1}
      >
        {value ?? ''}
      </Text>
      <Icon as={ChevronRight} size={16} className="text-tertiary group-active:text-tertiary" />
    </Button>
  );
}

/** Row of 56 pt: title, one line of explanation and a control on the right (or below if `stacked`). */
export function Row({
  label,
  hint,
  children,
  stacked = false,
}: {
  label?: string;
  hint?: string;
  children?: ReactNode;
  stacked?: boolean;
}) {
  return (
    <View
      className={cn(
        'min-h-row-settings gap-3 px-4 py-2.5',
        !stacked && 'flex-row items-center justify-between',
      )}
    >
      {label || hint ? (
        <View className={cn('gap-0.5', !stacked && 'flex-1 pr-3')}>
          {label ? <Text className="text-body-sm font-medium">{label}</Text> : null}
          {hint ? (
            <Text className="text-tertiary text-caption group-active:text-tertiary font-normal">
              {hint}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Detail view shown in place of the Mission list: back link, title and its groups. */
export function DetailView({
  title,
  subtitle,
  backLabel,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <View className="gap-8">
      <View className="gap-2">
        <Button
          variant="ghost"
          onPress={onBack}
          className="min-h-touch h-auto flex-row gap-1 self-start px-0 sm:h-auto"
          accessibilityLabel={backLabel}
        >
          <Icon as={ChevronLeft} size={20} className="text-link" />
          <Text className="text-link text-body-sm font-medium">{backLabel}</Text>
        </Button>
        <ScreenHeader title={title} subtitle={subtitle} />
      </View>
      <DetailTitle.Provider value={title}>{children}</DetailTitle.Provider>
    </View>
  );
}
