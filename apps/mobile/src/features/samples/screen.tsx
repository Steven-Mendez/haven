import {
  type Level,
  type SampleStatus,
  sampleConfig,
  sampleReading,
  sampleStates,
} from '@haven/core';
import { randomUUID } from 'expo-crypto';
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
  SegmentedControl,
} from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { store, useMission, usePreferences, useReadings } from '@/shared/data';
import { useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { texts } from './i18n';

const STATUS_LEVEL: Record<SampleStatus, Level> = {
  collected: 'green',
  due: 'amber',
  overdue: 'red',
  upcoming: 'pending',
};

export default function Screen() {
  const t = useTexts(texts);
  const h = useTexts(havenTexts);
  const translate = useTranslate();
  const mission = useMission();
  const readings = useReadings();
  const { crewMember } = usePreferences();
  const [modules, setModules] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const now = new Date();
  const day = Math.max(1, mission.day);
  const states = useMemo(
    () => sampleStates(sampleConfig, day, readings, new Date()),
    [day, readings],
  );

  const collect = async (sample: string, module?: string) => {
    try {
      await store.saveReading(
        sampleReading(sample, {
          crewMember,
          takenAt: new Date().toISOString(),
          newId: randomUUID,
          ...(module ? { module } : {}),
        }),
      );
      setFailed(false);
    } catch (error) {
      console.warn('[samples] save failed', error);
      setFailed(true);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="bg-background flex-1"
      contentContainerClassName="gap-8 p-4 pb-16"
    >
      <ScreenHeader title={t.title} subtitle={t.subtitle} />
      <Section title={format(t.day, { day })}>
        <View className="border-border overflow-hidden rounded-lg border">
          {states.map((state, i) => {
            const sample = sampleConfig.samples.find((s) => s.id === state.sample);
            if (!sample) return null;
            const module = modules[sample.id] ?? sample.modules?.[0]?.id;
            const lastModule = sample.modules?.find((m) => m.id === state.last?.module);
            const age = state.last
              ? ageText(h, (now.getTime() - Date.parse(state.last.takenAt)) / 60_000)
              : undefined;
            return (
              <View key={sample.id} className={cn('gap-3 p-4', i > 0 && 'border-border border-t')}>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <Text className="text-body font-semibold">{translate(sample.name)}</Text>
                    <Text className="text-muted-foreground text-body-sm">
                      {translate(sample.detail)}
                    </Text>
                    <Text className="text-tertiary text-caption">
                      {[
                        age
                          ? lastModule
                            ? format(t.lastModule, { age, module: translate(lastModule.name) })
                            : format(t.last, { age })
                          : '',
                        format(t.next, { day: state.nextDay }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <LevelBadge level={STATUS_LEVEL[state.status]} label={t[state.status]} />
                </View>
                {sample.modules?.length && module ? (
                  <SegmentedControl
                    accessibilityLabel={t.chooseModule}
                    options={sample.modules.map((m) => ({ value: m.id, label: translate(m.name) }))}
                    value={module}
                    onChange={(v) => setModules((prev) => ({ ...prev, [sample.id]: v }))}
                  />
                ) : null}
                <BigButton
                  label={t.collect}
                  variant={
                    state.status === 'due' || state.status === 'overdue' ? 'primary' : 'secondary'
                  }
                  onPress={() =>
                    void collect(sample.id, sample.modules?.length ? module : undefined)
                  }
                />
              </View>
            );
          })}
        </View>
      </Section>

      {failed ? <Text className="text-body">{t.saveFailed}</Text> : null}

      <Section title={t.source}>
        <Text className="text-tertiary text-caption">{sampleConfig.source}</Text>
      </Section>
    </ScrollView>
  );
}
