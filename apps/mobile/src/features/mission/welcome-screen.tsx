import { Redirect } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ScreenHeader } from '@/shared/components/haven';
import { Screen } from '@/shared/components/screen';
import { Text } from '@/shared/components/ui/text';
import { useDataReady, useMission, usePreferences } from '@/shared/data';
import { useTexts } from '@/shared/i18n';
import { type Joined, JoinForm } from './components/mission-group';
import { WhoGroup } from './components/who-group';
import { useMissionRecords } from './hooks/missions';
import { texts } from './i18n';

export default function WelcomeScreen() {
  const t = useTexts(texts);
  const ready = useDataReady();
  const { joined } = usePreferences();
  const mission = useMission();
  const records = useMissionRecords();
  const [found, setFound] = useState<Joined | undefined>();

  if (ready && joined) return <Redirect href="/" />;

  return (
    <Screen header={false} keyboardShouldPersistTaps="handled">
      <View className="gap-6 pt-10">
        <ScreenHeader title={t.welcomeTitle} size="title" />
        {found ? (
          <>
            <Text accessibilityLiveRegion="polite" className="text-body">
              {found.message}
            </Text>
            <WhoGroup
              crew={found.crew}
              offline={found.offline}
              onChoose={(member) => void records.chooseCrewMember(member.id)}
              onTyped={async (name) => {
                await records.addTypedCrewMember(found.code, name);
              }}
            />
          </>
        ) : (
          <>
            <Text className="text-body">{t.welcomeBody}</Text>
            <Text className="text-muted-foreground text-body">{t.welcomeNoQr}</Text>
            <JoinForm records={records} mission={{ ...mission, crew: [] }} onJoined={setFound} />
          </>
        )}
      </View>
    </Screen>
  );
}
