import {
  asNeededToday,
  canRecordDose,
  type Dose,
  type DoseStatus,
  doseReading,
  dosesForDay,
  type Level,
  medications,
  recordableFrom,
} from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ageText,
  BigButton,
  EmptyState,
  format,
  havenTexts,
  LevelBadge,
  ScreenHeader,
  Section,
} from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { store, usePreferences, useReadings } from '@/shared/data';
import { useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { usePlan } from '@/shared/plan';
import { texts } from './i18n';

const STATUS_LEVEL: Record<DoseStatus, Level> = {
  taken: 'green',
  skipped: 'amber',
  missed: 'red',
  due: 'amber',
  upcoming: 'pending',
};

const medicationOf = (id: string) => medications.catalog.find((m) => m.id === id);

function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Screen() {
  const t = useTexts(texts);
  const h = useTexts(havenTexts);
  const translate = useTranslate();
  const plan = usePlan();
  const readings = useReadings();
  const { crewMember } = usePreferences();
  const now = useMinute();
  const [failed, setFailed] = useState(false);

  const doses = useMemo(
    () => (plan ? dosesForDay(plan, medications, readings, now) : []),
    [plan, readings, now],
  );
  const asNeeded = useMemo(
    () => (plan ? asNeededToday(plan, medications, readings, now) : []),
    [plan, readings, now],
  );

  const record = async (
    medication: string,
    dose: { status: 'taken' | 'skipped'; scheduledAt?: string },
  ) => {
    try {
      await store.saveReading(
        doseReading(medication, dose, {
          crewMember,
          takenAt: new Date().toISOString(),
          newId: randomUUID,
        }),
      );
      setFailed(false);
    } catch (error) {
      console.warn('[medication] save failed', error);
      setFailed(true);
    }
  };

  if (!plan || plan.medications.length === 0) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="bg-background flex-1"
        contentContainerClassName="gap-8 p-4"
      >
        <ScreenHeader title={t.title} subtitle={t.subtitle} />
        <EmptyState title={t.empty} description={t.emptyDetail} />
      </ScrollView>
    );
  }

  const doseRow = (dose: Dose, i: number) => {
    const med = medicationOf(dose.medication);
    const open = canRecordDose(dose, medications, now);
    const later = dose.status === 'upcoming' && !open;
    return (
      <View
        key={`${dose.medication}-${dose.scheduledAt}`}
        className={cn('gap-3 p-4', i > 0 && 'border-border border-t')}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-body font-semibold">{translate(med?.name)}</Text>
            <Text className="text-muted-foreground text-body-sm">
              {format(t.at, { time: dose.scheduledAt.slice(11, 16) })} ·{' '}
              {translate(med?.instructions)}
            </Text>
          </View>
          <LevelBadge level={STATUS_LEVEL[dose.status]} label={t[dose.status]} />
        </View>
        {open ? (
          <View className="flex-row gap-2">
            <BigButton
              className="flex-1"
              label={t.take}
              variant={dose.status === 'upcoming' ? 'secondary' : 'primary'}
              onPress={() =>
                void record(dose.medication, { status: 'taken', scheduledAt: dose.scheduledAt })
              }
            />
            <BigButton
              className="flex-1"
              label={t.skip}
              variant="ghost"
              onPress={() =>
                void record(dose.medication, { status: 'skipped', scheduledAt: dose.scheduledAt })
              }
            />
          </View>
        ) : later ? (
          <Text className="text-tertiary text-caption">
            {format(t.availableFrom, { time: recordableFrom(dose, medications).slice(11, 16) })}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="bg-background flex-1"
      contentContainerClassName="gap-8 p-4 pb-16"
    >
      <ScreenHeader
        title={t.title}
        subtitle={`${t.subtitle} ${format(t.updated, {
          age: ageText(h, (now.getTime() - Date.parse(plan.updatedAt)) / 60_000),
        })}`}
      />

      <Section title={t.today} count={doses.length || undefined}>
        {doses.length ? (
          <View className="border-border overflow-hidden rounded-lg border">
            {doses.map(doseRow)}
          </View>
        ) : (
          <Text className="text-muted-foreground text-body-sm">{t.nothingToday}</Text>
        )}
      </Section>

      {asNeeded.length ? (
        <Section title={t.asNeeded}>
          <View className="border-border overflow-hidden rounded-lg border">
            {asNeeded.map((a, i) => {
              const med = medicationOf(a.medication);
              return (
                <View
                  key={a.medication}
                  className={cn('gap-3 p-4', i > 0 && 'border-border border-t')}
                >
                  <View className="gap-0.5">
                    <Text className="text-body font-semibold">{translate(med?.name)}</Text>
                    <Text className="text-muted-foreground text-body-sm">
                      {translate(med?.instructions)}
                    </Text>
                    <Text className="text-tertiary text-caption tabular-nums">
                      {format(t.countToday, { taken: a.taken, max: a.maxPerDay })}
                    </Text>
                  </View>
                  {a.canTake ? (
                    <BigButton
                      variant="secondary"
                      label={t.takeNow}
                      onPress={() => void record(a.medication, { status: 'taken' })}
                    />
                  ) : (
                    <Text className="text-body-sm">{t.maxReached}</Text>
                  )}
                </View>
              );
            })}
          </View>
        </Section>
      ) : null}

      <Section title={t.plan}>
        <View className="gap-3">
          {plan.medications.map((a) => {
            const med = medicationOf(a.medication);
            return (
              <View key={a.medication} className="gap-0.5">
                <Text className="text-body-sm font-medium">{translate(med?.name)}</Text>
                <Text className="text-muted-foreground text-caption">
                  {translate(med?.purpose)}
                  {a.until ? ` · ${format(t.until, { date: a.until })}` : ''}
                </Text>
                {a.note ? <Text className="text-caption">{a.note}</Text> : null}
              </View>
            );
          })}
        </View>
      </Section>

      {failed ? <Text className="text-body">{t.saveFailed}</Text> : null}

      <Section title={t.source}>
        <Text className="text-tertiary text-caption">{medications.source}</Text>
      </Section>
    </ScrollView>
  );
}
