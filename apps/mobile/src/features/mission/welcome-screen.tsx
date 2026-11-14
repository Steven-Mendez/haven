import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { format, ScreenHeader } from '@/shared/components/haven';
import { Screen } from '@/shared/components/screen';
import { Text } from '@/shared/components/ui/text';
import { useDataReady, useMission, usePreferences } from '@/shared/data';
import { useTexts } from '@/shared/i18n';
import { texts } from './i18n';

export default function WelcomeScreen() {
  const t = useTexts(texts);
  const ready = useDataReady();
  const { joined } = usePreferences();
  const mission = useMission();

  if (ready && joined) return <Redirect href="/" />;

  return (
    <Screen header={false}>
      <View className="gap-6 pt-10">
        <ScreenHeader title={t.welcomeTitle} size="title" />
        {mission.status === 'finished' ? (
          <Text accessibilityLiveRegion="polite" className="text-body font-semibold">
            {format(t.welcomeFinished, { mission: mission.name ?? mission.code })}
          </Text>
        ) : null}
        <Text className="text-body">{t.welcomeHow}</Text>
      </View>
    </Screen>
  );
}
