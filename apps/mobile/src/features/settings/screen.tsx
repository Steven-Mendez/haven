import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
  Bell,
  Code,
  Compass,
  Database,
  Info,
  Languages,
  LogOut,
  Moon,
  Rocket,
  Satellite,
  Send,
  Trash2,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import {
  format,
  InlineConfirm,
  ListGroup,
  Section,
  SegmentedControl,
} from '@/shared/components/haven';
import { SettingsRow } from '@/shared/components/haven/settings-row';
import { useCrewMemberName } from '@/shared/components/profile-button';
import { Screen } from '@/shared/components/screen';
import { Text } from '@/shared/components/ui/text';
import { type Appearance, store, useMission, usePendingSends, usePreferences } from '@/shared/data';
import { bus } from '@/shared/events';
import { type Language, useTexts } from '@/shared/i18n';
import { requestTour } from '@/shared/tour';
import { texts } from './i18n';

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

export default function SettingsScreen() {
  const t = useTexts(texts);
  const preferences = usePreferences();
  const mission = useMission();
  const queued = usePendingSends();
  const name = useCrewMemberName();
  const missionName = mission.name ?? mission.code;
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const version = Constants.expoConfig?.version ?? '—';
  const build = Constants.nativeBuildVersion ?? undefined;
  const appearance: Appearance = preferences.appearance ?? 'dark';

  return (
    <Screen contentClassName="gap-section">
      <Section title={t.session}>
        <ListGroup inset={52}>
          <SettingsRow
            icon={Rocket}
            label={t.mission}
            value={missionName}
            onPress={() => router.push('/mission')}
          />
          <SettingsRow
            icon={User}
            label={t.profile}
            value={name}
            onPress={() => router.push('/profile')}
          />
        </ListGroup>
        {confirmSignOut ? (
          <InlineConfirm
            title={t.signOutTitle}
            description={format(t.signOutDescription, { mission: missionName, name })}
            confirmLabel={t.signOutConfirm}
            confirmVariant="destructive"
            onCancel={() => setConfirmSignOut(false)}
            onConfirm={() => {
              setConfirmSignOut(false);
              bus.emit('session:signout', {});
              router.dismissTo('/');
            }}
          />
        ) : (
          <ListGroup inset={52}>
            <SettingsRow
              icon={LogOut}
              label={t.signOut}
              hint={t.signOutHint}
              destructive
              chevron={false}
              onPress={() => setConfirmSignOut(true)}
            />
          </ListGroup>
        )}
      </Section>

      <Section title={t.general}>
        <ListGroup inset={52}>
          <SettingsRow
            icon={Languages}
            label={t.language}
            accessibilityLabel={t.language}
            trailing={
              <SegmentedControl
                accessibilityLabel={t.language}
                options={LANGUAGE_OPTIONS}
                value={preferences.language}
                onChange={(language) => void preferences.set({ language })}
                className="w-44"
              />
            }
          />
          <SettingsRow
            icon={Moon}
            label={t.appearance}
            accessibilityLabel={t.appearance}
            trailing={
              <SegmentedControl<Appearance>
                accessibilityLabel={t.appearance}
                options={[
                  { value: 'dark', label: t.dark },
                  { value: 'light', label: t.light },
                  { value: 'system', label: t.system },
                ]}
                value={appearance}
                onChange={(next) => void preferences.set({ appearance: next })}
                className="w-52"
              />
            }
          />
        </ListGroup>
        <Text className="text-tertiary text-caption px-1">{t.appearanceHint}</Text>
      </Section>

      <Section title={t.alerts}>
        <ListGroup inset={52}>
          <SettingsRow
            icon={Bell}
            label={t.permissions}
            hint={t.permissionsHint}
            onPress={() => void Linking.openSettings()}
          />
          <SettingsRow icon={Database} label={t.sources} onPress={() => router.push('/sources')} />
          <SettingsRow
            icon={Compass}
            label={t.tour}
            hint={t.tourHint}
            onPress={() => {
              router.dismissTo('/');
              requestTour();
            }}
          />
        </ListGroup>
      </Section>

      <Section title={t.link}>
        <ListGroup inset={52}>
          <SettingsRow
            icon={mission.linkDown ? WifiOff : Wifi}
            label={t.linkStatus}
            value={mission.linkDown ? t.linkDown : t.linkUp}
            chevron={false}
          />
          <SettingsRow
            icon={Send}
            label={t.queue}
            value={queued > 0 ? format(t.queued, { n: queued }) : t.nothingQueued}
            onPress={() => router.push('/queue')}
          />
          <SettingsRow
            icon={Satellite}
            label={t.linkMore}
            onPress={() => router.push({ pathname: '/mission', params: { focus: 'link' } })}
          />
        </ListGroup>
        <Text className="text-tertiary text-caption px-1">{t.linkDownHint}</Text>
      </Section>

      <Section title={t.data}>
        {confirmDelete ? (
          <InlineConfirm
            title={t.deleteTitle}
            description={t.deleteDescription}
            confirmLabel={t.deleteConfirm}
            confirmVariant="destructive"
            onCancel={() => setConfirmDelete(false)}
            onConfirm={async () => {
              setConfirmDelete(false);
              await store.reset();
              setDeleted(true);
            }}
          />
        ) : (
          <ListGroup inset={52}>
            <SettingsRow
              icon={Trash2}
              label={t.deleteData}
              hint={deleted ? t.deleted : t.deleteHint}
              destructive
              chevron={false}
              onPress={() => {
                setDeleted(false);
                setConfirmDelete(true);
              }}
            />
          </ListGroup>
        )}
      </Section>

      <Section title={t.developer}>
        <ListGroup inset={52}>
          <SettingsRow icon={Code} label={t.devPanel} onPress={() => router.push('/dev')} />
        </ListGroup>
      </Section>

      <Section title={t.about}>
        <ListGroup inset={52}>
          <SettingsRow icon={Info} label={t.version} value={version} mono />
          {build ? <SettingsRow label={t.build} value={build} mono /> : null}
        </ListGroup>
        <View className="items-center pt-4">
          <Text className="text-tertiary text-caption">{t.credits}</Text>
        </View>
      </Section>
    </Screen>
  );
}
