import { BASELINE_MINIMUM, BASELINE_N, type Level } from '@haven/core';
import { router, Stack } from 'expo-router';
import { Database, Settings } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';
import {
  ageText,
  format,
  hasDay,
  havenTexts,
  LevelSymbol,
  ListGroup,
  levelLabel,
  missionPhase,
  Section,
  useMissionPhaseText,
} from '@/shared/components/haven';
import { SettingsRow } from '@/shared/components/haven/settings-row';
import { CrewAvatar, useCrewMemberName } from '@/shared/components/profile-button';
import { Screen } from '@/shared/components/screen';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import {
  useAgeMin,
  useAssessments,
  useEvaluatedAt,
  useMission,
  usePreferences,
  useReadings,
} from '@/shared/data';
import { useGamification } from '@/shared/gamification';
import { useLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { MONO_FONT } from '@/shared/lib/theme';
import { texts } from './i18n';
import { baselineCoverage, daysOfData, levelCounts } from './logic/profile';

const LEVEL_ORDER: Level[] = ['red', 'amber', 'pending', 'green'];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      className="flex-row items-baseline gap-1"
    >
      <Text className="text-body-sm font-semibold tabular-nums">{value}</Text>
      <Text className="text-muted-foreground text-body-sm">{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const t = useTexts(texts);
  const phaseText = useMissionPhaseText();
  const h = useTexts(havenTexts);
  const language = useLanguage();
  const translate = useTranslate();
  const mission = useMission();
  const { crewMember } = usePreferences();
  const name = useCrewMemberName();
  const assessments = useAssessments();
  const readings = useReadings();
  const evaluatedAt = useEvaluatedAt();
  const evaluatedAge = useAgeMin(evaluatedAt);

  const me = mission.crew.find((c) => c.id === crewMember);
  const environment = config.environments.find((e) => e.id === mission.environment);
  const counts = levelCounts(assessments);
  const coverage = baselineCoverage(assessments);
  const days = useMemo(() => daysOfData(readings, Date.now()), [readings]);
  const { streak } = useGamification();
  const number = (n: number) => n.toLocaleString(language === 'es' ? 'es-ES' : 'en-US');

  return (
    <Screen contentClassName="gap-6">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button
              variant="ghost"
              size="icon"
              accessibilityRole="button"
              accessibilityLabel={t.openSettings}
              hitSlop={10}
              onPress={() => router.push('/settings')}
              className="h-auto w-auto rounded-none active:bg-transparent active:opacity-70 sm:h-auto sm:w-auto"
            >
              <Icon as={Settings} size={22} strokeWidth={1.75} className="text-foreground" />
            </Button>
          ),
        }}
      />

      <View className="gap-4">
        <CrewAvatar size={72} />
        <View className="gap-1">
          <Text role="heading" aria-level="1" className="text-title font-bold">
            {name}
          </Text>
          <Text className="text-muted-foreground text-body-sm">
            {[t.crewMember, environment ? translate(environment.name) : mission.environment]
              .concat(me?.hasWatch ? [t.withWatch] : [])
              .join(' · ')}
          </Text>
          <Text
            className="text-tertiary text-mono"
            style={{ fontFamily: MONO_FONT }}
            accessibilityLabel={`${mission.code}, ${crewMember}`}
          >
            {`${mission.code} · ${crewMember}`}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          {hasDay(missionPhase(mission)) ? (
            <Stat value={number(mission.day)} label={t.missionDay} />
          ) : (
            <Stat value="—" label={phaseText(mission)} />
          )}
          <Stat value={number(streak)} label={t.streakShort} />
          <Stat value={number(mission.crew.length)} label={t.crew} />
        </View>
      </View>

      <Section title={t.statusSection}>
        <Button
          variant="outline"
          accessibilityRole="button"
          accessibilityHint={t.statusHint}
          onPress={() => router.push('/')}
          className="active:bg-active border-border h-auto items-stretch justify-start gap-0 rounded-lg px-0 py-0 sm:h-auto"
        >
          {LEVEL_ORDER.map((level, i) => (
            <View
              key={level}
              accessible
              accessibilityLabel={`${counts[level]} ${levelLabel(h, level)}`}
              className={`flex-1 gap-1.5 px-2.5 py-3 ${i > 0 ? 'border-border border-l' : ''}`}
            >
              <Text className="text-title font-semibold tabular-nums">{counts[level]}</Text>
              <View className="flex-row items-center gap-1.5">
                <LevelSymbol level={level} size={8} />
                <Text
                  className="text-muted-foreground text-caption group-active:text-muted-foreground shrink font-normal"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {levelLabel(h, level)}
                </Text>
              </View>
            </View>
          ))}
        </Button>
      </Section>

      <Section title={t.baselineSection}>
        <ListGroup>
          <SettingsRow
            label={t.baselineIndicators}
            value={format(t.baselineCoverage, { ready: coverage.ready, total: coverage.total })}
          />
          <SettingsRow
            label={t.daysOfData}
            value={days > 0 ? format(t.days, { n: number(days) }) : t.noData}
          />
          <SettingsRow label={t.readings} value={number(readings.length)} />
          <SettingsRow
            label={t.streak}
            value={format(t.days, { n: number(streak) })}
            onPress={() => router.push('/streak')}
          />
          <SettingsRow label={t.recalculated} value={ageText(h, evaluatedAge)} />
        </ListGroup>
        <Text className="text-tertiary text-caption px-1">
          {format(t.baselineHint, { n: BASELINE_N, min: BASELINE_MINIMUM })}
        </Text>
      </Section>

      <Section title={t.linksSection}>
        <ListGroup inset={52}>
          <SettingsRow icon={Database} label={t.sources} onPress={() => router.push('/sources')} />
          <SettingsRow
            icon={Settings}
            label={t.settings}
            onPress={() => router.push('/settings')}
          />
        </ListGroup>
      </Section>
    </Screen>
  );
}
