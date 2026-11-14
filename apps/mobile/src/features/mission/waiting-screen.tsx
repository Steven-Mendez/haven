import { router } from 'expo-router';
import { Hourglass } from 'lucide-react-native';
import { View } from 'react-native';
import { BigButton, format, ScreenHeader } from '@/shared/components/haven';
import { useCrewMemberName } from '@/shared/components/profile-button';
import { Screen } from '@/shared/components/screen';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { useMission } from '@/shared/data';
import { useLanguage, useTexts } from '@/shared/i18n';
import { texts } from './i18n';

export default function WaitingScreen() {
  const t = useTexts(texts);
  const language = useLanguage();
  const mission = useMission();
  const name = useCrewMemberName();
  const missionName = mission.name ?? mission.code;
  const startsOn =
    mission.status === 'scheduled' && mission.start
      ? new Date(mission.start).toLocaleDateString(language, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : undefined;

  return (
    <Screen header={false}>
      <View className="gap-6 pt-10" accessibilityLiveRegion="polite">
        <Icon as={Hourglass} size={48} className="text-muted-foreground" />
        <ScreenHeader title={t.waitingTitle} size="title" />
        <Text className="text-body">
          {format(t.waitingSignedIn, { mission: missionName, name })}
        </Text>
        <Text className="text-muted-foreground text-body">
          {startsOn ? format(t.waitingScheduled, { date: startsOn }) : t.waitingBody}
        </Text>
        <BigButton
          label={t.waitingSettings}
          variant="secondary"
          onPress={() => router.push('/settings')}
        />
      </View>
    </Screen>
  );
}
