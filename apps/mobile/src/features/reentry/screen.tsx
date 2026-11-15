import {
  isReentry,
  ORTHOSTATIC_ITEM,
  type ReentryReadiness,
  reentry,
  reentryCheckReading,
  reentryStatus,
} from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ageText,
  BigButton,
  format,
  havenTexts,
  LevelBadge,
  ScreenHeader,
  Section,
} from '@/shared/components/haven';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { store, useMission, usePreferences, useReadings } from '@/shared/data';
import { useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { OrthostaticTest } from './components/orthostatic-test';
import { texts } from './i18n';

type T = (typeof texts)['es'];

function readinessDetail(t: T, readiness: ReentryReadiness): string | undefined {
  if (readiness === 'ready') return t.readyDetail;
  if (readiness === 'review') return t.reviewDetail;
  if (readiness === 'unfit') return t.unfitDetail;
  return undefined;
}

export default function Screen() {
  const t = useTexts(texts);
  const h = useTexts(havenTexts);
  const translate = useTranslate();
  const mission = useMission();
  const readings = useReadings();
  const { crewMember } = usePreferences();
  const [testing, setTesting] = useState(false);
  const status = useMemo(() => reentryStatus(readings, reentry, new Date()), [readings]);

  const mark = (item: string) =>
    store.saveReading(
      reentryCheckReading(item, {
        crewMember,
        takenAt: new Date().toISOString(),
        newId: randomUUID,
      }),
    );

  if (testing) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="bg-background flex-1"
        contentContainerClassName="gap-8 p-4 pb-16"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <OrthostaticTest onClose={() => setTesting(false)} />
      </ScrollView>
    );
  }

  const detail = readinessDetail(t, status.readiness);
  const o = status.orthostatic;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="bg-background flex-1"
      contentContainerClassName="gap-8 p-4 pb-16"
    >
      <ScreenHeader
        title={t.title}
        subtitle={isReentry(mission.environment) ? t.subtitleActive : t.subtitleAhead}
      />

      <Section title={t.readiness}>
        <View className="border-border gap-2 rounded-lg border p-4">
          <View className="flex-row items-center justify-between gap-3">
            <LevelBadge level={status.level} size="lg" label={t[status.readiness]} />
            <Text className="text-muted-foreground text-body-sm tabular-nums">
              {format(t.progress, { done: status.done, total: status.total })}
            </Text>
          </View>
          {detail ? <Text className="text-body">{detail}</Text> : null}
          {o ? (
            <Text className="text-muted-foreground text-body-sm tabular-nums">
              {format(t.lastTest, { supine: o.supine, standing: o.standing, rise: o.rise })}
            </Text>
          ) : null}
        </View>
      </Section>

      <Section title={t.checklist}>
        <View className="border-border overflow-hidden rounded-lg border">
          {reentry.checklist.map((item, i) => {
            const doneAt = status.items.find((x) => x.id === item.id)?.doneAt;
            const ageMin = doneAt ? (Date.now() - Date.parse(doneAt)) / 60_000 : undefined;
            const isTest = item.id === ORTHOSTATIC_ITEM;
            return (
              <View key={item.id} className={cn('gap-3 p-4', i > 0 && 'border-border border-t')}>
                <View className="flex-row items-start gap-3">
                  <View
                    className={cn(
                      'mt-0.5 size-6 items-center justify-center rounded-full border',
                      doneAt ? 'bg-brand border-brand' : 'border-border-strong',
                    )}
                  >
                    {doneAt ? (
                      <Icon
                        as={Check}
                        size={14}
                        strokeWidth={3}
                        className="text-primary-foreground"
                      />
                    ) : null}
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-body font-semibold">{translate(item.name)}</Text>
                    <Text className="text-muted-foreground text-body-sm">
                      {translate(item.detail)}
                    </Text>
                    {doneAt ? (
                      <Text className="text-tertiary text-caption">
                        {format(t.doneAt, { age: ageText(h, ageMin) })}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {isTest ? (
                  <BigButton
                    variant={doneAt ? 'secondary' : 'primary'}
                    label={doneAt ? t.repeatTest : t.startTest}
                    onPress={() => setTesting(true)}
                  />
                ) : doneAt ? null : (
                  <View className="gap-2">
                    <BigButton label={t.markDone} onPress={() => void mark(item.id)} />
                    {item.id === 'fluid-loading' ? (
                      <BigButton
                        variant="ghost"
                        label={t.logFluids}
                        onPress={() =>
                          router.push({
                            pathname: '/indicator/[id]',
                            params: { id: 'hydration', measure: '1' },
                          })
                        }
                      />
                    ) : null}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Section>

      <Section title={t.source}>
        <Text className="text-tertiary text-caption">{reentry.source}</Text>
      </Section>
    </ScrollView>
  );
}
