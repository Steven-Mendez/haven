import { useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  format,
  hasDay,
  missionPhase,
  ScreenHeader,
  useMissionPhaseText,
} from '@/shared/components/haven';
import { ProfileButton } from '@/shared/components/profile-button';
import { useScreenInsets } from '@/shared/components/screen';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { useMission, usePreferences } from '@/shared/data';
import { useLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { TourAnchor, useTourScroll } from '@/shared/tour';
import { CrewGroup } from './components/crew-group';
import { EnvironmentPicker } from './components/environment-group';
import { formatDelay } from './components/format';
import { MissionGroup } from './components/mission-group';
import { ProfileGroup } from './components/profile-group';
import { DetailView, Group, LinkRow, Row } from './components/rows';
import { RulesGroup } from './components/rules-group';
import { SettingsGroup } from './components/settings-group';
import { useMissionRecords } from './hooks/missions';
import { usePreflightBaseline } from './hooks/preflight';
import { useEarthRules } from './hooks/rules';
import { texts } from './i18n';

type MissionView = 'list' | 'mission' | 'environment' | 'crew' | 'profile' | 'rules' | 'settings';

/**
 * M05 · Mission (DESIGN_SYSTEM §8.9, X settings / Apple Health sources): no mission strip (the first
 * group is the mission), one-line rows (title + value), a grey note under the group only where
 * behaviour changes (no link). The link with Earth is detected, and the communication delay is
 * mission data: neither is adjustable here.
 * Each row opens its detail in place. `/mission?focus=link` scrolls to the link group.
 */
export default function Screen() {
  const t = useTexts(texts);
  const translate = useTranslate();
  const language = useLanguage();
  // The tabs layout already reserves the top safe area (§8.0.6: no mission strip here).
  const insets = useScreenInsets();
  const mission = useMission();
  const preferences = usePreferences();
  const { crewMember } = preferences;
  const records = useMissionRecords();
  const record = records.recordFor(mission.code);
  // Rules from Earth are polled while the Mission tab is mounted, whatever view is open.
  const rules = useEarthRules();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // First-run tour: lets it scroll Mission to its target.
  const onTourScroll = useTourScroll('mission', scroll);
  const [linkY, setLinkY] = useState<number | undefined>();
  const [view, setView] = useState<MissionView>('list');
  const { baseline } = usePreflightBaseline(crewMember, view);
  const phaseText = useMissionPhaseText();
  // A mission without a stored record still remembers the chosen destination for this session.
  const [destination, setDestination] = useState<string | undefined>(record?.destination);
  const chosenDestination = destination ?? record?.destination;

  useEffect(() => {
    if (focus === 'link' && linkY !== undefined && view === 'list') {
      scroll.current?.scrollTo({ y: Math.max(0, linkY - 16), animated: false });
    }
  }, [focus, linkY, view]);

  const open = (next: MissionView) => {
    setView(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const back = () => open('list');

  const onChange = (changes: {
    environment: string;
    currentDelayMin: number;
    destination?: string;
  }) => {
    setDestination(changes.destination);
    void records.update(mission.code, changes);
  };

  const environment = config.environments.find((e) => e.id === mission.environment);
  const crew = mission.crew;
  const you = crew.find((c) => c.id === crewMember)?.name ?? crewMember;
  const preflightCount = Object.keys(baseline?.values ?? {}).length;
  const phase = missionPhase(mission);
  const missionName = record?.name ?? mission.name ?? mission.code;
  const missionValue =
    phase.kind === 'running' && record
      ? format(t.dayShort, { day: phase.day, total: record.durationDays })
      : phaseText(mission);
  const rulesValue = rules.latest
    ? format(t.rulesValue, {
        version: rules.latest.version,
        state: rules.latest.status === 'applied' ? t.rulesApplied : t.rulesPendingConfirm,
      })
    : t.rulesNoneShort;

  const detail = () => {
    switch (view) {
      case 'mission':
        return (
          <DetailView title={t.missionGroup} subtitle={t.qrHint} backLabel={t.title} onBack={back}>
            <MissionGroup mission={mission} records={records} record={record} />
          </DetailView>
        );
      case 'environment':
        return (
          <EnvironmentPicker
            mission={mission}
            destination={chosenDestination}
            onChange={onChange}
            onDone={back}
          />
        );
      case 'crew':
        return (
          <DetailView title={t.crewGroup} subtitle={t.crewHint} backLabel={t.title} onBack={back}>
            <CrewGroup mission={mission} />
          </DetailView>
        );
      case 'profile':
        return (
          <DetailView
            title={t.profileGroup}
            subtitle={t.profileHint}
            backLabel={t.title}
            onBack={back}
          >
            <ProfileGroup key={crewMember} />
          </DetailView>
        );
      case 'rules':
        return (
          <DetailView title={t.rulesGroup} subtitle={t.rulesHint} backLabel={t.title} onBack={back}>
            <RulesGroup rules={rules} />
          </DetailView>
        );
      case 'settings':
        return (
          <DetailView title={t.settingsGroup} backLabel={t.title} onBack={back}>
            <SettingsGroup />
          </DetailView>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView
      ref={scroll}
      onScroll={onTourScroll}
      scrollEventThrottle={32}
      className="bg-background flex-1"
      contentContainerClassName="gap-8 px-4 pt-4"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom,
        paddingLeft: 16 + insets.left,
        paddingRight: 16 + insets.right,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {view !== 'list' ? (
        detail()
      ) : (
        <>
          <ScreenHeader title={t.title} right={<ProfileButton />} />

          {/* Flighty: the big day number on the left, mission and link status on the right. */}
          <Button
            variant="outline"
            accessibilityRole="button"
            accessibilityLabel={`${missionName}, ${missionValue}, ${
              mission.linkDown ? t.linkStatusDown : t.linkStatusUp
            }`}
            onPress={() => open('mission')}
            className="border-border active:bg-active h-auto justify-start gap-4 rounded-lg px-4 py-4 sm:h-auto"
          >
            <View className="w-20 items-start">
              <Text className="text-tertiary text-micro group-active:text-tertiary font-semibold uppercase">
                {hasDay(phase) ? t.dayCaps : t.preparingCaps}
              </Text>
              <Text className="text-metric font-bold tabular-nums">
                {hasDay(phase) ? phase.day : '—'}
              </Text>
            </View>
            <View className="bg-border w-px self-stretch" />
            <View className="flex-1 gap-1.5">
              <Text className="text-body-sm font-semibold" numberOfLines={1}>
                {missionName}
              </Text>
              {phase.kind !== 'running' ? (
                <Text className="text-caption group-active:text-foreground font-medium">
                  {phaseText(mission)}
                </Text>
              ) : null}
              <Text
                className="text-muted-foreground text-caption group-active:text-muted-foreground font-normal"
                numberOfLines={1}
              >
                {[
                  environment ? translate(environment.name) : mission.environment,
                  format(t.delayValue, { delay: formatDelay(mission.currentDelayMin, language) }),
                ].join(' · ')}
              </Text>
              <View className="flex-row items-center gap-1.5">
                <View
                  className={
                    mission.linkDown
                      ? 'border-muted-foreground h-2 w-2 rounded-full border'
                      : 'bg-level-green h-2 w-2 rounded-full'
                  }
                />
                <Text className="text-caption font-medium">
                  {mission.linkDown ? t.linkStatusDown : t.linkStatusUp}
                </Text>
              </View>
            </View>
            <Icon
              as={ChevronRight}
              size={16}
              className="text-tertiary group-active:text-tertiary"
            />
          </Button>

          <Group title={t.missionGroup}>
            <LinkRow
              key="mission"
              label={missionName}
              value={missionValue}
              onPress={() => open('mission')}
            />
            <LinkRow
              key="environment"
              label={t.environmentShort}
              value={[
                environment ? translate(environment.name) : mission.environment,
                formatDelay(mission.currentDelayMin, language),
              ].join(' · ')}
              onPress={() => open('environment')}
            />
            <LinkRow
              key="crew"
              label={t.crewShort}
              value={format(t.crewValue, { n: crew.length, name: you })}
              onPress={() => open('crew')}
            />
          </Group>

          <Group title={t.linkGroup} hint={t.linkOnHint} onLayout={setLinkY}>
            {/* Detected, not switched: the earth queue checks Earth and sets `linkDown`. */}
            <TourAnchor step="mission-link" fill>
              <Row label={t.linkOn}>
                <View
                  accessible
                  accessibilityLabel={mission.linkDown ? t.linkStatusDown : t.linkStatusUp}
                  className="flex-row items-center gap-1.5"
                >
                  <View
                    className={
                      mission.linkDown
                        ? 'border-muted-foreground h-2 w-2 rounded-full border'
                        : 'bg-level-green h-2 w-2 rounded-full'
                    }
                  />
                  <Text className="text-muted-foreground text-body-sm">
                    {mission.linkDown ? t.linkStatusDown : t.linkStatusUp}
                  </Text>
                </View>
              </Row>
            </TourAnchor>
            <LinkRow
              key="rules"
              label={t.rulesShort}
              value={rulesValue}
              onPress={() => open('rules')}
            />
          </Group>

          <Group title={t.settingsGroup}>
            <LinkRow
              key="settings"
              label={t.languageRow}
              value={preferences.language === 'es' ? 'Español' : 'English'}
              onPress={() => open('settings')}
            />
          </Group>

          <Group title={t.profileShortGroup}>
            <LinkRow
              key="profile"
              label={t.profileShort}
              value={preflightCount > 0 ? format(t.preflightValue, { n: preflightCount }) : '—'}
              onPress={() => open('profile')}
            />
          </Group>
        </>
      )}
    </ScrollView>
  );
}
