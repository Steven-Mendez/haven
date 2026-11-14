import { cognitiveVerdict, type Reading } from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BigButton, DataLabel, EmptyState, ScreenHeader, Section } from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { config as activeConfig, useConfig } from '@/shared/config';
import { store, useMission, usePreferences, useReadings } from '@/shared/data';
import { bus } from '@/shared/events';
import { useLanguage, useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { Footer } from './components/footer';
import { GoNoGoTest } from './components/go-nogo-test';
import { MemoryTest } from './components/memory-test';
import { More } from './components/more';
import { PvtTest } from './components/pvt-test';
import { ResultView } from './components/result-view';
import { WhereFrom } from './components/where-from';
import { texts } from './i18n';
import { batteryReadings, interruptsBattery, isTimedOut, type PvtResult } from './logic/battery';
import { cognitiveNoticePacket } from './logic/notice';

type Phase =
  | 'intro'
  | 'pvt'
  | 'pre-memory'
  | 'memory'
  | 'pre-gonogo'
  | 'gonogo'
  | 'saving'
  | 'result'
  | 'interrupted';

const RUNNING: Phase[] = ['pvt', 'pre-memory', 'memory', 'pre-gonogo', 'gonogo'];
const random = Math.random;

const unitOf = (id: string) => activeConfig.indicators.find((i) => i.id === id)?.unit ?? '';

export default function Screen() {
  const t = useTexts(texts);
  const insets = useSafeAreaInsets();
  const config = useConfig();
  const language = useLanguage();
  const mission = useMission();
  const { crewMember } = usePreferences();
  const readings = useReadings();
  const [tick, setTick] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh on new readings and every 30 s
  const now = useMemo(() => new Date(), [readings, tick]);
  const verdict = useMemo(
    () => cognitiveVerdict(readings, config, mission.environment, {}, now),
    [readings, config, mission.environment, now],
  );

  const { autostart } = useLocalSearchParams<{ autostart?: string }>();
  const [phase, setPhase] = useState<Phase>(() => (verdict.canRetake ? 'intro' : 'result'));
  const [timedOut, setTimedOut] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const startedAt = useRef(0);
  const pvt = useRef<PvtResult | null>(null);
  const memory = useRef<number | null>(null);
  const running = RUNNING.includes(phase);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const interrupt = useCallback((timeout: boolean) => {
    if (!RUNNING.includes(phaseRef.current)) return;
    pvt.current = null;
    memory.current = null;
    setTimedOut(timeout);
    setPhase('interrupted');
  }, []);

  // Leaving the app (background, call) or running past 225 s interrupts: nothing is saved.
  useEffect(() => {
    if (!running) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (interruptsBattery(state)) interrupt(false);
    });
    const timer = setInterval(() => {
      if (isTimedOut(startedAt.current, Date.now())) interrupt(true);
    }, 1_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [running, interrupt]);

  const start = () => {
    startedAt.current = Date.now();
    pvt.current = null;
    memory.current = null;
    setTimedOut(false);
    setPhase('pvt');
  };

  const finish = async (goNoGo: number) => {
    if (phaseRef.current !== 'gonogo' || !pvt.current || memory.current === null) return;
    if (isTimedOut(startedAt.current, Date.now())) return interrupt(true);
    setPhase('saving');
    const takenAt = new Date().toISOString();
    const list: Reading[] = batteryReadings(
      { pvt: pvt.current, memory: memory.current, goNoGo },
      { crewMember, takenAt, newId: randomUUID, unitOf },
    );
    await store.saveReadings(list);
    const at = new Date();
    const result = cognitiveVerdict(store.readings(), config, store.mission().environment, {}, at);
    if (result.notifyEarth) {
      const m = store.mission();
      bus.emit('packet:enqueue', {
        packet: cognitiveNoticePacket({
          id: randomUUID(),
          crewMember,
          mission: m.code,
          now: at,
          assessments: result.assessments,
          readings: list,
          notes: result.explanation[language],
        }),
      });
    }
    setPhase('result');
  };

  const exit = () => interrupt(false);

  // From Routine ("Start", DESIGN_SYSTEM.md 4.1b) go straight to the tests once the crew member has
  // already seen "how it works" (any previous on-screen battery); the first time, show it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: decided once on mount
  useEffect(() => {
    const seen = readings.some((r) => r.indicator === 'reaction-time' && r.source === 'screen');
    if (autostart === '1' && verdict.canRetake && seen) start();
  }, []);
  const lastReaction = readings.filter((r) => r.indicator === 'reaction-time').at(-1);

  if (running) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        {phase === 'pvt' ? (
          <PvtTest
            t={t}
            random={random}
            onExit={exit}
            onDone={(r) => {
              pvt.current = r;
              setPhase('pre-memory');
            }}
          />
        ) : phase === 'memory' ? (
          <MemoryTest
            t={t}
            random={random}
            onExit={exit}
            onDone={(score) => {
              memory.current = score;
              setPhase('pre-gonogo');
            }}
          />
        ) : phase === 'gonogo' ? (
          <GoNoGoTest t={t} random={random} onExit={exit} onDone={(a) => void finish(a)} />
        ) : (
          <View
            className="bg-background flex-1 justify-center gap-8 px-6"
            style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
          >
            <Text className="text-title text-center font-bold">
              {phase === 'pre-memory' ? t.nextMemory : t.nextGoNoGo}
            </Text>
            <BigButton
              size="lg"
              label={t.next}
              onPress={() => setPhase(phase === 'pre-memory' ? 'memory' : 'gonogo')}
            />
            <BigButton label={t.exit} variant="ghost" onPress={exit} />
          </View>
        )}
      </>
    );
  }

  return (
    <View className="bg-background flex-1">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="bg-background flex-1"
        contentContainerClassName="gap-8 p-4 pb-8"
      >
        <Stack.Screen options={{ headerShown: true }} />
        {phase === 'saving' ? (
          <Text className="text-body text-muted-foreground">{t.saving}</Text>
        ) : phase === 'result' ? (
          <ResultView
            t={t}
            verdict={verdict}
            config={config}
            environment={mission.environment}
            linkDown={mission.linkDown}
            now={now.getTime()}
            reaction={lastReaction}
            onRepeat={start}
          />
        ) : phase === 'interrupted' ? (
          <EmptyState
            title={t.interrupted}
            description={timedOut ? t.interruptedTimeout : t.interruptedDetail}
          />
        ) : (
          <>
            <ScreenHeader title={t.title} subtitle={t.subtitle} />
            <Section title={t.how}>
              <View className="border-border rounded-lg border">
                {(
                  [
                    [t.step1, t.step1Detail],
                    [t.step2, t.step2Detail],
                    [t.step3, t.step3Detail],
                  ] as const
                ).map(([title, detail], i) => (
                  <View
                    key={title}
                    className={cn(
                      'min-h-row flex-row items-center gap-4 px-4 py-2',
                      i > 0 && 'border-border border-t',
                    )}
                  >
                    <Text className="text-title text-tertiary w-6 font-bold tabular-nums">
                      {i + 1}
                    </Text>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-body-sm font-semibold">{title}</Text>
                      <Text className="text-tertiary text-caption">{detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Section>
            <More label={t.more}>
              <Text className="text-body text-muted-foreground">{t.rules}</Text>
              <DataLabel
                source={lastReaction?.source ?? 'screen'}
                ageMin={
                  lastReaction
                    ? Math.max(
                        0,
                        Math.floor((now.getTime() - Date.parse(lastReaction.takenAt)) / 60_000),
                      )
                    : undefined
                }
              />
              <WhereFrom text={t.whereFrom} />
            </More>
          </>
        )}
      </ScrollView>
      {/* Main action fixed at the foot, above the home indicator (8.12, safe areas) */}
      {phase === 'intro' || phase === 'interrupted' ? (
        <Footer>
          <BigButton size="lg" label={phase === 'intro' ? t.start : t.repeat} onPress={start} />
        </Footer>
      ) : null}
    </View>
  );
}
