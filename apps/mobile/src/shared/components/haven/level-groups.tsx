import type { Level } from '@haven/core';
import { View } from 'react-native';

import { Button } from '@/shared/components/ui/button';
import { Text, TextClassContext } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';

import { havenTexts } from './i18n';
import { LEVEL_TEXT_CLASS, levelLabel, levelPhrase } from './level';

/** Display order of the groups: worst first, pending last (Tonal sections, HAVEN order). */
const ORDER: Level[] = ['red', 'amber', 'green', 'pending'];

/** Filled segments per level, Tonal readiness style (user request): in range 3 · check 2 · emergency 1. */
const FILLED: Record<Level, number> = { green: 3, amber: 2, red: 1, pending: 0 };
const FILL: Record<Level, string> = {
  green: 'bg-level-green',
  amber: 'bg-level-amber',
  red: 'bg-level-red',
  pending: 'bg-muted',
};

type Item = { id: string; label: string; selected?: boolean };

type Props = {
  groups: Partial<Record<Level, Item[]>>;
  onPressItem?: (id: string) => void;
  /** Long-press on a chip (context sheet). */
  onLongPressItem?: (id: string) => void;
  /** Tap on a level header / meter: explain what the level means (popover). */
  onPressLevel?: (level: Level) => void;
  /** Override the grey line under each header (default: the level phrase). */
  descriptions?: Partial<Record<Level, string>>;
  className?: string;
};

/**
 * Level sections with chips (Tonal «Muscle Readiness»): bold caps level name + a small filled
 * 3-segment meter, one grey line saying what the level means, then a chip per zone / indicator in
 * that level. Only non-empty groups, in order Emergency → Check → In range → Pending.
 */
export function LevelGroups({
  groups,
  onPressItem,
  onLongPressItem,
  onPressLevel,
  descriptions,
  className,
}: Props) {
  const t = useTexts(havenTexts);
  const shown = ORDER.filter((level) => (groups[level]?.length ?? 0) > 0);
  return (
    <View className={cn('gap-7', className)}>
      {shown.map((level) => (
        <View key={level} className="gap-3">
          <Button
            variant="ghost"
            role={onPressLevel ? 'button' : undefined}
            accessibilityRole={onPressLevel ? 'button' : undefined}
            disabled={!onPressLevel}
            onPress={() => onPressLevel?.(level)}
            className={cn(
              'h-auto flex-col items-stretch justify-start gap-1 self-start rounded-none px-0 py-0 active:bg-transparent active:opacity-70 sm:h-auto',
              !onPressLevel && 'opacity-100',
            )}
          >
            {/* The header keeps its own type styles, not the button's text defaults. */}
            <TextClassContext.Provider value={undefined}>
              <View className="flex-row items-center gap-3">
                <Text
                  role="heading"
                  aria-level="2"
                  className={cn(
                    'text-[15px] leading-5 font-bold tracking-[0.6px] uppercase',
                    level === 'pending' ? 'text-foreground' : LEVEL_TEXT_CLASS[level],
                  )}
                >
                  {levelLabel(t, level)}
                </Text>
                <View aria-hidden className="flex-row gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      className={cn(
                        'h-1 w-3 rounded-[1px]',
                        i < FILLED[level] ? FILL[level] : 'bg-muted',
                      )}
                    />
                  ))}
                </View>
              </View>
              <Text className="text-muted-foreground text-body-sm">
                {descriptions?.[level] ?? levelPhrase(t, level)}
              </Text>
            </TextClassContext.Provider>
          </Button>
          <View className="flex-row flex-wrap gap-2">
            {groups[level]?.map((item) => (
              <Button
                key={item.id}
                variant="secondary"
                accessibilityRole="button"
                accessibilityLabel={`${item.label}: ${levelLabel(t, level)}`}
                accessibilityState={{ selected: !!item.selected }}
                disabled={!onPressItem}
                onPress={() => onPressItem?.(item.id)}
                onLongPress={onLongPressItem ? () => onLongPressItem(item.id) : undefined}
                hitSlop={{ top: 6, bottom: 6 }}
                className={cn(
                  'h-8 flex-col items-stretch justify-center gap-0 rounded-sm px-3 py-0 active:opacity-70 sm:h-8',
                  item.selected ? 'bg-foreground active:bg-foreground' : 'bg-muted active:bg-muted',
                  !onPressItem && 'opacity-100',
                )}
              >
                <Text
                  className={cn(
                    'text-[12px] leading-4 font-semibold tracking-[0.6px] uppercase',
                    item.selected ? 'text-background' : 'text-foreground',
                  )}
                >
                  {item.label}
                </Text>
              </Button>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
