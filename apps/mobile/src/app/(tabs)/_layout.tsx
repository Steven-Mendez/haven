import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Activity, ChartLine, ListChecks, Rocket } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WaitingScreen } from '@/features/mission';
import { InTabsProvider } from '@/shared/components/screen';
import { HavenTabBar, type TabIcons } from '@/shared/components/tab-bar';
import { useDataReady, useMission, usePreferences } from '@/shared/data';
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
  const ready = useDataReady();
  const { joined } = usePreferences();

  const { status } = useMission();

  if (ready && !joined) return <Redirect href="/welcome" />;
  if (ready && (status === 'planned' || status === 'scheduled')) {
    return (
      <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
        <WaitingScreen />
      </View>
    );
  }

  return (
    <InTabsProvider>
      <TourProvider>
        <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
          <Tabs
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
