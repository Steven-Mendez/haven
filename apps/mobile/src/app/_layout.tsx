import '../../global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { View } from 'react-native';
import { startEarthQueue } from '@/features/earth-queue';
import { startHealthSources } from '@/features/health-sources';
import { startMissionSync } from '@/features/mission';
import { startNotifications } from '@/features/notifications';
import { InfoSheetHost } from '@/shared/components/info-sheet';
import { ToastHost } from '@/shared/components/toast';
import { Spinner } from '@/shared/components/ui/spinner';
import { Text } from '@/shared/components/ui/text';
import { usePreferences } from '@/shared/data';
import { useTexts } from '@/shared/i18n';
import { navigationTexts } from '@/shared/i18n/navigation';
import { DEFAULT_SCHEME, NAV_THEME } from '@/shared/lib/theme';
import { useEmergencyListener, useStartup } from '@/shared/startup';

export {
  // Catches any error thrown by the layout.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const t = useTexts(navigationTexts);
  const phase = useStartup();
  useEmergencyListener();
  // M07 · M08 · M09 (Draco): health providers, notifications and Earth queue, once data is ready;
  // M05: the mission state follows Earth (preparation, running, finished).
  useEffect(() => {
    if (phase === 'ready')
      for (const start of [
        startHealthSources,
        startNotifications,
        startEarthQueue,
        startMissionSync,
      ])
        void start();
  }, [phase]);

  // On board the app uses dark mode (low light, OLED); see DISENO.md. Settings › Appearance can
  // switch to light or follow the system (persisted preference, dark by default).
  const { appearance } = usePreferences();
  useEffect(() => {
    setColorScheme(appearance ?? DEFAULT_SCHEME);
  }, [setColorScheme, appearance]);

  const scheme = colorScheme ?? DEFAULT_SCHEME;

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          // Back shows only the chevron: never the «(tabs)» group name.
          headerBackButtonDisplayMode: 'minimal',
          headerBackTitle: t.back,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="indicator/[id]" options={{ title: t.indicator }} />
        <Stack.Screen
          name="emergency"
          // M06 draws its own close button inside its strip and applies the insets itself.
          options={{ title: t.emergency, presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen name="dev" options={{ title: t.dev, presentation: 'modal' }} />
        <Stack.Screen name="send" options={{ title: t.send }} />
        <Stack.Screen name="queue" options={{ title: t.queue }} />
        <Stack.Screen name="cognition" options={{ title: t.cognition }} />
        <Stack.Screen name="wellbeing" options={{ title: t.wellbeing }} />
        <Stack.Screen name="sources" options={{ title: t.sources }} />
        <Stack.Screen name="profile" options={{ title: t.profile }} />
        <Stack.Screen name="settings" options={{ title: t.settings }} />
        <Stack.Screen name="streak" options={{ title: t.streak }} />
      </Stack>
      {phase === 'starting' ? (
        <View className="bg-background absolute inset-0 items-center justify-center gap-4">
          <Spinner size={32} className="text-muted-foreground" />
          <Text className="text-muted-foreground">{t.loading}</Text>
        </View>
      ) : null}
      {/* Global confirmation toasts and the «explain in place» sheet (above every screen). */}
      <ToastHost />
      <InfoSheetHost />
      <PortalHost />
    </ThemeProvider>
  );
}
