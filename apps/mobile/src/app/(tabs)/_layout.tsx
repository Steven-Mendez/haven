import { Tabs } from 'expo-router/js-tabs';
import { Activity, ChartLine, ListChecks, Rocket } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InTabsProvider } from '@/shared/components/screen';
import { HavenTabBar, type TabIcons } from '@/shared/components/tab-bar';
import { useTexts } from '@/shared/i18n';
import { navigationTexts } from '@/shared/i18n/navigation';
import { TourProvider } from '@/shared/tour';

const ICONS: TabIcons = {
  index: Activity,
  routine: ListChecks,
  trends: ChartLine,
  mission: Rocket,
};

export default function TabsLayout() {
  const t = useTexts(navigationTexts);
  const insets = useSafeAreaInsets();

  return (
    <InTabsProvider>
      {/* First-run tour: wraps the tabs so it can point at Body and at the tab bar's SOS. */}
      <TourProvider>
        {/* No top bar on any tab (Withings, Hers): each screen puts the avatar beside its title and
          the SOS is the centre of the tab bar. The top inset is padded here, so content scrolls
          under an opaque strip, never under the clock. */}
        <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
          <Tabs
            // SPEC.md: outline icons, active in foreground, hairline top border, on background.
            tabBar={(props) => <HavenTabBar {...props} icons={ICONS} />}
            screenOptions={{ headerShown: false }}
          >
            <Tabs.Screen name="index" options={{ title: t.body }} />
            <Tabs.Screen name="routine" options={{ title: t.routine }} />
            <Tabs.Screen name="trends" options={{ title: t.trends }} />
            <Tabs.Screen name="mission" options={{ title: t.mission }} />
          </Tabs>
        </View>
      </TourProvider>
    </InTabsProvider>
  );
}
