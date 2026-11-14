import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { BigButton, format, ScreenHeader } from '@/shared/components/haven';
import { Screen } from '@/shared/components/screen';
import { Icon } from '@/shared/components/ui/icon';
import { Spinner } from '@/shared/components/ui/spinner';
import { Text } from '@/shared/components/ui/text';
import { store } from '@/shared/data';
import { useTexts } from '@/shared/i18n';
import { useStartup } from '@/shared/startup';
import { WhoGroup } from './components/who-group';
import { useMissionRecords } from './hooks/missions';
import { texts } from './i18n';
import { cleanCrewName } from './logic/crew';
import { invitedMember, parseInvite } from './logic/invite';
import type { MissionRecord } from './logic/mission-record';

type State =
  | { step: 'joining'; code?: string }
  | { step: 'who'; record: MissionRecord }
  | { step: 'done'; mission: string; name: string }
  | { step: 'error'; message: string; retry: boolean };

export default function JoinScreen() {
  const t = useTexts(texts);
  const params = useLocalSearchParams<{ mission?: string; crew?: string; api?: string }>();
  const phase = useStartup();
  const records = useMissionRecords();
  const [state, setState] = useState<State>({ step: 'joining' });
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const started = useRef<string | undefined>(undefined);
  const { mission, crew: crewParam, api } = params;
  const key = `${mission}|${crewParam}|${api}`;

  const run = useCallback(async () => {
    const records = recordsRef.current;
    const parsed = parseInvite({ mission, crew: crewParam, api });
    if (!parsed.ok) {
      setState({ step: 'error', message: t.inviteInvalid, retry: false });
      return;
    }
    const { code, crew, apiUrl } = parsed.invite;
    setState({ step: 'joining', code });
    if (apiUrl) await store.setPreferences({ apiUrl });
    const result = await records.join(code, { allowOffline: false });
    if (result.from === 'unknown') {
      setState({ step: 'error', message: format(t.unknownCode, { code }), retry: false });
      return;
    }
    if (result.from === 'unreachable') {
      const message = format(t.inviteUnreachable, { url: store.preferences().apiUrl });
      setState({ step: 'error', message, retry: true });
      return;
    }
    const member = invitedMember(result.record.crew, crew);
    if (member) {
      await records.chooseCrewMember(member.id);
      setState({ step: 'done', mission: result.record.name, name: member.name });
    } else {
      setState({ step: 'who', record: result.record });
    }
  }, [mission, crewParam, api, t]);

  useEffect(() => {
    if (phase !== 'ready' || started.current === key) return;
    started.current = key;
    void run();
  }, [phase, key, run]);

  const home = () => router.dismissTo('/');

  const body = () => {
    switch (state.step) {
      case 'joining':
        return (
          <View className="items-center gap-4 py-16" accessibilityLiveRegion="polite">
            <Spinner size={32} className="text-muted-foreground" />
            <Text className="text-muted-foreground text-body">
              {state.code ? format(t.inviteJoining, { code: state.code }) : t.joining}
            </Text>
          </View>
        );
      case 'who':
        return (
          <View className="gap-6">
            <Text className="text-body">
              {format(t.inviteNotListed, { mission: state.record.name })}
            </Text>
            <WhoGroup
              crew={state.record.crew ?? []}
              offline={false}
              onChoose={(member) => {
                void records
                  .chooseCrewMember(member.id)
                  .then(() =>
                    setState({ step: 'done', mission: state.record.name, name: member.name }),
                  );
              }}
              onTyped={async (name) => {
                await records.addTypedCrewMember(state.record.code, name);
                setState({ step: 'done', mission: state.record.name, name: cleanCrewName(name) });
              }}
            />
          </View>
        );
      case 'done':
        return (
          <View className="gap-6" accessibilityLiveRegion="polite">
            <Icon as={CircleCheck} size={48} className="text-level-green" />
            <ScreenHeader
              title={format(t.inviteDone, { mission: state.mission, name: state.name })}
              size="title"
            />
            <Text className="text-muted-foreground text-body">{t.inviteDoneHint}</Text>
            <BigButton label={t.inviteHome} onPress={home} />
          </View>
        );
      case 'error':
        return (
          <View className="gap-6" accessibilityLiveRegion="assertive">
            <Icon as={CircleAlert} size={48} className="text-level-amber" />
            <ScreenHeader title={t.inviteErrorTitle} size="title" />
            <Text className="text-body">{state.message}</Text>
            {state.retry ? (
              <BigButton
                label={t.inviteRetry}
                onPress={() => {
                  setState({ step: 'joining' });
                  void run();
                }}
              />
            ) : null}
            <BigButton
              label={t.inviteHome}
              variant={state.retry ? 'secondary' : 'primary'}
              onPress={home}
            />
          </View>
        );
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t.inviteTitle, headerBackVisible: false }} />
      <Screen>{body()}</Screen>
    </>
  );
}
