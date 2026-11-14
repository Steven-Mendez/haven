import {
  ChevronRight,
  Clock,
  type LucideIcon,
  SatelliteDish,
  Send,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text, TextClassContext } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { MONO_FONT } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

import { format, havenTexts } from './i18n';

type Props = {
  /** Mission code (`Mission.code`, e.g. "ARES01"), shown in mono. */
  code: string;
  /** Mission name: shown instead of the code when present (the code is not the way in any more). */
  name?: string;
  day: number;
  /** Replaces «Day n» when the mission is not running («Being prepared», «Starts on …», «Finished · day n»). */
  dayLabel?: string;
  /** Environment name in the current language (`Environment.name[lang]`). */
  environment: string;
  /** One-way delay in minutes (`Mission.currentDelayMin`). One decimal under 1. */
  delayMin: number;
  /** `Mission.linkDown`. */
  linkDown: boolean;
  /** Packets waiting to be sent (`usePendingSends()`). */
  queued: number;
  /** Opens the queue screen (the "n queued" chip becomes a link). */
  onPressQueue?: () => void;
  /** Opens Mission with the Link group in view (shortcut, DESIGN_SYSTEM.md §4.1d). */
  onPressLink?: () => void;
  /**
   * compact (default, §8.0.6): a round 44 pt link button with a status dot and the queue count, only on Body.
   * full: the two-line version with chips.
   */
  variant?: 'compact' | 'full';
  className?: string;
};

const MONO = MONO_FONT;

function Chip({
  icon,
  label,
  strong,
  onPress,
  chevron,
}: {
  icon: LucideIcon;
  label: string;
  strong?: boolean;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const body = (
    <View
      className={cn(
        'h-7 flex-row items-center gap-1.5 rounded-full px-2.5',
        strong ? 'bg-elevated border-border-strong border' : 'bg-muted',
      )}
    >
      <Icon
        as={icon}
        size={14}
        strokeWidth={2}
        className={strong ? 'text-foreground' : 'text-muted-foreground'}
      />
      <Text
        className={cn(
          'text-caption tabular-nums',
          strong ? 'text-foreground font-medium' : 'text-muted-foreground',
        )}
      >
        {label}
      </Text>
      {chevron ? <Icon as={ChevronRight} size={14} className="text-muted-foreground" /> : null}
    </View>
  );
  if (!onPress)
    return (
      <View accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  return (
    <Button
      variant="link"
      role="link"
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
      className="h-auto flex-col items-stretch justify-start gap-0 rounded-none px-0 py-0 active:opacity-70 sm:h-auto"
    >
      {/* The chip keeps its own type styles, not the link's text defaults. */}
      <TextClassContext.Provider value={undefined}>{body}</TextClassContext.Provider>
    </Button>
  );
}

/**
 * Mission header. Default compact: a round link button beside SOS (§8.0.6). `variant="full"`: mission line +
 * delay/link/queue chips (DESIGN_SYSTEM.md §3.7), ~52 pt tall. M00's
 * `MissionHeader` feeds it. Link down is neutral (elevated chip, primary text), never amber.
 */
export function MissionStrip({
  code,
  name,
  day,
  dayLabel,
  environment,
  delayMin,
  linkDown,
  queued,
  onPressQueue,
  onPressLink,
  variant = 'compact',
  className,
}: Props) {
  const t = useTexts(havenTexts);
  const delay = delayMin < 1 ? Math.round(delayMin * 10) / 10 : Math.round(delayMin);
  const dayText = dayLabel ?? format(t.day, { n: day });
  const title = name ?? code;
  const titleStyle = name ? undefined : { fontFamily: MONO };

  if (variant === 'compact') {
    const a11y = [
      title,
      dayText,
      environment,
      format(t.delay, { n: delay }),
      linkDown ? t.linkDown : t.linkUp,
      queued > 0 ? format(t.queued, { n: queued }) : undefined,
    ]
      .filter(Boolean)
      .join(', ');
    // Garmin's watch icon with a status dot: one round button beside SOS. The mission name and day
    // live in Body's greeting; link down or a queue shows as a strip in Body, not here.
    return (
      <Button
        variant="ghost"
        role={onPressLink ? 'link' : undefined}
        accessibilityRole={onPressLink ? 'link' : 'text'}
        accessibilityLabel={a11y}
        disabled={!onPressLink}
        onPress={onPressLink}
        className={cn(
          'bg-muted active:bg-active size-11 rounded-full p-0 sm:size-11',
          !onPressLink && 'opacity-100',
          className,
        )}
      >
        <TextClassContext.Provider value={undefined}>
          <Icon
            as={linkDown ? WifiOff : SatelliteDish}
            size={20}
            strokeWidth={1.75}
            className="text-foreground"
          />
          <View
            className={cn(
              'border-background absolute top-1.5 right-1.5 h-3 w-3 rounded-full border-2',
              linkDown ? 'bg-muted-foreground' : 'bg-level-green',
            )}
          />
          {queued > 0 ? (
            <View className="bg-foreground border-background absolute -right-1 -bottom-1 h-5 min-w-5 items-center justify-center rounded-full border-2 px-1">
              <Text className="text-background text-[10px] leading-[12px] font-bold tabular-nums">
                {queued}
              </Text>
            </View>
          ) : null}
        </TextClassContext.Provider>
      </Button>
    );
  }

  return (
    <View className={cn('bg-background gap-2 px-5 py-2.5', className)}>
      <Text className="text-footnote font-medium" numberOfLines={1}>
        <Text className="text-footnote font-medium" style={titleStyle}>
          {title}
        </Text>
        {` · ${dayText} · ${environment}`}
      </Text>
      <View className="flex-row flex-wrap items-center gap-2">
        <Chip icon={Clock} label={format(t.delay, { n: delay })} />
        <Chip
          icon={linkDown ? WifiOff : Wifi}
          label={linkDown ? t.linkDown : t.linkUp}
          strong={linkDown}
          onPress={onPressLink}
        />
        <Chip
          icon={Send}
          label={queued > 0 ? format(t.queued, { n: queued }) : t.nothingQueued}
          onPress={onPressQueue}
          chevron={!!onPressQueue}
        />
      </View>
    </View>
  );
}
