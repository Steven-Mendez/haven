import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { Fragment } from 'react';
import { Platform, View } from 'react-native';

import { havenTexts } from '@/shared/components/haven/i18n';
import { SosButton } from '@/shared/components/haven/sos-button';
import { showToast } from '@/shared/components/toast';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { armNextEmergency } from '@/shared/emergency-arm';
import { bus } from '@/shared/events';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { TourAnchor } from '@/shared/tour';

/** Icon per tab route name (outline lucide icons, X style). */
export type TabIcons = Record<string, LucideIcon>;

/**
 * HAVEN tab bar (SPEC.md §6 «Barra de pestañas»): on `background` with a 1 px top hairline, outline
 * icons, the active tab in `foreground` (heavier stroke), the rest in grey. The round SOS sits in
 * the centre slot (Bevel's centre «+»): on every tab, always one tap away, never over content.
 * Tap → emergency screen (its own 3 s hold); hold the SOS 3 s → the emergency starts directly.
 */
export function HavenTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
  icons,
}: BottomTabBarProps & { icons: TabIcons }) {
  const t = useTexts(havenTexts);
  const middle = Math.floor(state.routes.length / 2);
  const sos = (
    <View key="sos" className="flex-1 items-center justify-center">
      <TourAnchor step="sos" center>
        <View>
          <SosButton
            onPress={() => router.push({ pathname: '/emergency', params: { origin: 'button' } })}
            onHoldComplete={() => {
              armNextEmergency();
              bus.emit('emergency:open', { origin: 'button' });
            }}
            onHoldCancel={() => showToast(t.sosHoldToast, { icon: false })}
          />
        </View>
      </TourAnchor>
    </View>
  );
  return (
    <View
      className="bg-background border-border flex-row items-center border-t px-2"
      style={{ paddingBottom: Math.max(insets.bottom - 6, 8), paddingTop: 6 }}
      role="tablist"
    >
      {state.routes.map((route, index) => {
        const focused = index === state.index;
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;
        const icon = icons[route.name];
        const onPress = () => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Fragment key={route.key}>
            {index === middle ? sos : null}
            <Button
              variant="ghost"
              role="tab"
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              className={cn(
                'min-h-touch h-auto flex-1 flex-col items-center justify-center gap-0.5 rounded-none px-0 py-1 active:bg-transparent active:opacity-70 sm:h-auto',
                Platform.select({ web: 'has-[>svg]:px-0' }),
              )}
            >
              {icon ? (
                <Icon
                  as={icon}
                  size={24}
                  strokeWidth={focused ? 2.25 : 1.75}
                  className={
                    focused
                      ? 'text-foreground'
                      : 'text-muted-foreground group-active:text-muted-foreground'
                  }
                />
              ) : null}
              <Text
                className={cn(
                  'text-[11px] leading-[13px]',
                  focused
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground group-active:text-muted-foreground font-normal',
                )}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Button>
          </Fragment>
        );
      })}
    </View>
  );
}
