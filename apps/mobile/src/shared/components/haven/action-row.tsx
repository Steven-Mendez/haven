import { Check, Minus } from 'lucide-react-native';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Progress } from '@/shared/components/ui/progress';
import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';

import { clamp01 } from './geometry';
import { havenTexts } from './i18n';
import { zoneIcon } from './level';

type Props = {
  /** Action text (`Zone.dailyAction.text[lang]`, `Action.text[lang]`). */
  title: string;
  /** Time estimate or due info ("< 4 min", "due 2 h ago"). */
  detail?: string;
  /** Zone it belongs to: shows its line icon. */
  zone?: string;
  /** 0–1. At 1 the row shows "Done". */
  progress?: number;
  /** Start / open the action ("Measure" by default). Hidden when done or when onDone is set. */
  onStart?: () => void;
  /** Button label override ("Start", "Register"). Default "Measure". */
  startLabel?: string;
  /** Actions without a reading: inline "✓ Done · — Skip" control (each target ≥ 44 pt). */
  onDone?: () => void;
  onSkip?: () => void;
  /**
   * Undo the current choice: called when the selected control (✓ or —) is pressed again.
   * Without it, pressing «— Skipped» again calls `onSkip` (toggle handled by the feature).
   */
  onUndo?: () => void;
  /** Shown state for the inline control. `done` is also implied by progress ≥ 1. */
  state?: 'open' | 'done' | 'skipped';
  /** The next due item: 2 pt accent leading bar (Tiimo / X). */
  next?: boolean;
  /** Render as a bare row for a `ListGroup`. Default: its own hairline box. */
  grouped?: boolean;
  className?: string;
};

/**
 * Today's list row (SPEC.md §6, routine): flat 52 pt row, zone line icon, 15/500 title, 13 pt grey
 * detail and a trailing text action («Measure») or a ✓ / — pair. No fills.
 */
export function ActionRow({
  title,
  detail,
  zone,
  progress = 0,
  onStart,
  startLabel,
  onDone,
  onSkip,
  onUndo,
  state = 'open',
  next = false,
  grouped = false,
  className,
}: Props) {
  const t = useTexts(havenTexts);
  const p = clamp01(progress);
  const done = p >= 1 || state === 'done';
  const skipped = state === 'skipped';
  const inline = !!(onDone || onSkip);

  const trailing = inline ? (
    <View className="flex-row items-center gap-1">
      {onDone ? (
        <Button
          variant={done ? 'default' : 'outline'}
          accessibilityRole="button"
          accessibilityState={{ selected: done }}
          accessibilityLabel={done ? `${t.undo}: ${t.done}, ${title}` : `${t.done}: ${title}`}
          onPress={() => (done ? onUndo?.() : onDone())}
          className={cn(
            'h-touch min-w-touch sm:h-touch gap-1 rounded-full px-3 py-0',
            done ? 'active:opacity-100' : 'active:bg-transparent active:opacity-70',
          )}
        >
          <Icon
            as={Check}
            size={16}
            strokeWidth={2}
            className={done ? 'text-primary-foreground' : 'text-foreground'}
          />
          <Text
            className={cn(
              'text-caption font-medium',
              done ? 'text-primary-foreground' : 'text-foreground',
            )}
          >
            {t.done}
          </Text>
        </Button>
      ) : null}
      {onSkip ? (
        <Button
          variant="ghost"
          accessibilityRole="button"
          accessibilityState={{ selected: skipped }}
          accessibilityLabel={skipped ? `${t.undo}: ${t.skipped}, ${title}` : `${t.skip}: ${title}`}
          onPress={() => (skipped ? (onUndo ?? onSkip)() : onSkip())}
          className={cn(
            'h-touch min-w-touch sm:h-touch gap-1 rounded-full px-2 py-0 active:bg-transparent active:opacity-70',
            Platform.select({ web: 'has-[>svg]:px-2' }),
          )}
        >
          <Icon
            as={Minus}
            size={16}
            strokeWidth={2}
            className="text-muted-foreground group-active:text-muted-foreground"
          />
          <Text className="text-muted-foreground group-active:text-muted-foreground text-caption font-medium">
            {skipped ? t.undo : t.skip}
          </Text>
        </Button>
      ) : null}
    </View>
  ) : done ? (
    <View accessible accessibilityLabel={t.done} className="flex-row items-center gap-1.5 px-1">
      <Icon as={Check} size={16} strokeWidth={2} className="text-muted-foreground" />
      <Text className="text-muted-foreground text-caption">{t.done}</Text>
    </View>
  ) : onStart ? (
    <Button
      variant="link"
      accessibilityRole="button"
      accessibilityLabel={`${startLabel ?? t.measure}: ${title}`}
      onPress={onStart}
      hitSlop={8}
      className="min-h-touch h-auto rounded-full px-1 py-0 sm:h-auto"
    >
      {/* The link variant dims the label on press (was active:opacity-70 on the button). */}
      <Text className="text-link text-body-sm font-semibold">{startLabel ?? t.measure}</Text>
    </Button>
  ) : null;

  const row = (
    <View className={cn('min-h-row flex-row items-center gap-3 px-4 py-2', className)}>
      {next ? (
        <View className="bg-brand absolute top-2 bottom-2 left-0 w-0.5 rounded-full" />
      ) : null}
      {zone ? (
        <Icon
          as={zoneIcon(zone)}
          size={20}
          strokeWidth={1.75}
          className={done || skipped ? 'text-tertiary' : 'text-muted-foreground'}
        />
      ) : null}
      <View className="flex-1 gap-0.5">
        <Text
          className={cn('text-body-sm font-medium', (done || skipped) && 'text-muted-foreground')}
          numberOfLines={2}
        >
          {title}
        </Text>
        {detail ? (
          <Text className="text-tertiary text-caption tabular-nums" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
        {p > 0 && !done ? <Progress value={p * 100} className="mt-1" /> : null}
      </View>
      {trailing}
    </View>
  );

  if (grouped) return row;
  return <ListGroup>{row}</ListGroup>;
}

/**
 * Grouped list (alias / X settings): rows inside ONE 1 px hairline box with no fill, divided by
 * hairlines inset 16 pt. `flat`: no outer box, only the dividers (full-bleed X list).
 */
export function ListGroup({
  children,
  flat = false,
  inset = 16,
  className,
}: {
  children: ReactNode;
  flat?: boolean;
  /** Divider inset from the leading edge (16 by default; 52 to start at the text column). */
  inset?: number;
  className?: string;
}) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View
      className={cn(
        'overflow-hidden',
        flat ? 'border-border border-y' : 'border-border rounded-lg border',
        className,
      )}
    >
      {items.map((child, i) => (
        <Fragment key={child.key ?? i}>
          {i > 0 ? <View className="bg-border h-px" style={{ marginLeft: inset }} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}
