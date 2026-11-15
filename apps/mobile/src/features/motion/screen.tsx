import {
  adaptationWindow,
  balanceAvailable,
  latestBalance,
  latestMotion,
  motion,
} from '@haven/core';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { format, LevelBadge, ScreenHeader, Section } from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { useConfig } from '@/shared/config';
import { useMission, useReadings } from '@/shared/data';
import { useTexts, useTranslate } from '@/shared/i18n';
import { BALANCE_LABEL, BalanceTest } from './components/balance-test';
import { HeadMovements } from './components/head-movements';
import { ScalePicker } from './components/scale-picker';
import { texts } from './i18n';

export default function Screen() {
  const t = useTexts(texts);
  const translate = useTranslate();
  const config = useConfig();
  const mission = useMission();
  const readings = useReadings();

  const window = useMemo(
    () => adaptationWindow(mission, motion, config.environments),
    [mission, config.environments],
  );
  const latest = useMemo(() => latestMotion(readings, motion), [readings]);
  const balance = useMemo(() => latestBalance(readings, motion), [readings]);
  const surface = balanceAvailable(mission.environment, config.environments);
  const environmentName = (id: string) =>
    translate(config.environments.find((e) => e.id === id)?.name) || id;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="bg-background flex-1"
      contentContainerClassName="gap-8 p-4 pb-16"
    >
      <ScreenHeader
        title={t.title}
        subtitle={
          window.open
            ? window.reason === 'launch'
              ? format(t.windowLaunch, { day: window.day, of: window.of })
              : format(t.windowTransition, {
                  day: window.day,
                  of: window.of,
                  environment: environmentName(window.environment),
                })
            : t.windowClosed
        }
      />

      {latest ? (
        <View className="border-border gap-2 rounded-lg border p-4">
          <LevelBadge level={latest.level} />
          <Text className="text-body font-medium">
            {format(t.last, {
              score: latest.score,
              label: translate(motion.scale.find((s) => s.score === latest.score)?.label),
            })}
          </Text>
          <Text className="text-muted-foreground text-body-sm">
            {latest.level === 'red'
              ? t.adviceRed
              : latest.level === 'amber'
                ? t.adviceAmber
                : t.adviceGreen}
          </Text>
        </View>
      ) : null}

      <Section title={t.howDoYouFeel}>
        <ScalePicker />
      </Section>

      <Section title={t.movements}>
        <HeadMovements />
      </Section>

      <Section title={t.balance}>
        {surface ? (
          <View className="gap-3">
            {balance ? (
              <View className="gap-1">
                <LevelBadge level={balance.level} label={t[BALANCE_LABEL[balance.level]]} />
                <Text className="text-muted-foreground text-body-sm">
                  {format(t.balanceLast, { closed: balance.closed, ratio: balance.ratio })}
                </Text>
              </View>
            ) : null}
            <BalanceTest />
          </View>
        ) : (
          <Text className="text-muted-foreground text-body-sm">{t.balanceNoGravity}</Text>
        )}
      </Section>

      <Section title={t.source}>
        <Text className="text-tertiary text-caption">{motion.source}</Text>
      </Section>
    </ScrollView>
  );
}
