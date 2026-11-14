import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight, PenLine, UserRound, Watch } from 'lucide-react-native';
import { View } from 'react-native';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text, TextClassContext } from '@/shared/components/ui/text';
import { cn } from '@/shared/lib/utils';

export type StartRow = {
  key: string;
  icon: 'measure' | 'sources' | 'who';
  title: string;
  detail: string;
  onPress: () => void;
};

const ICONS: Record<StartRow['icon'], LucideIcon> = {
  measure: PenLine,
  sources: Watch,
  who: UserRound,
};

/**
 * First-run card while there are no readings (Withings «Getting to know you», Gentler Streak):
 * a title, one line on what the first reading unlocks, and one large row per way in. The first
 * row is the main one and gets the filled icon.
 */
export function GettingStarted({
  title,
  body,
  rows,
}: {
  title: string;
  body: string;
  rows: StartRow[];
}) {
  return (
    <View className="border-border bg-elevated overflow-hidden rounded-lg border">
      <View className="gap-1 px-4 pt-4 pb-3">
        <Text role="heading" aria-level="2" className="text-title-sm font-semibold">
          {title}
        </Text>
        <Text className="text-muted-foreground text-body-sm">{body}</Text>
      </View>
      {rows.map((row, i) => (
        <Button
          key={row.key}
          variant="ghost"
          accessibilityRole="button"
          accessibilityLabel={`${row.title}. ${row.detail}`}
          onPress={row.onPress}
          className="active:bg-active border-border min-h-row-indicator h-auto justify-start gap-3 rounded-none border-t px-4 py-3 sm:h-auto"
        >
          {/* Reset Button's text classes: the row keeps its own type and colours. */}
          <TextClassContext.Provider value={undefined}>
            <View
              className={cn(
                'h-10 w-10 items-center justify-center rounded-full',
                i === 0 ? 'bg-primary' : 'bg-muted',
              )}
            >
              <Icon
                as={ICONS[row.icon]}
                size={20}
                strokeWidth={1.75}
                className={i === 0 ? 'text-primary-foreground' : 'text-foreground'}
              />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-body font-medium">{row.title}</Text>
              <Text className="text-muted-foreground text-caption" numberOfLines={2}>
                {row.detail}
              </Text>
            </View>
            <Icon as={ChevronRight} size={16} className="text-tertiary" />
          </TextClassContext.Provider>
        </Button>
      ))}
    </View>
  );
}
