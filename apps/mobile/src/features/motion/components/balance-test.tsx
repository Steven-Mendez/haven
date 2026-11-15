import {
  type BalanceResult,
  balanceReading,
  balanceResult,
  type Level,
  motion,
  swayMilliG,
} from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { BigButton, format, LevelBadge, StepTimer, useCountdown } from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { store, usePreferences } from '@/shared/data';
import { useTexts } from '@/shared/i18n';
import { texts } from '../i18n';

type Sample = { x: number; y: number; z: number };
type Phase =
  | { kind: 'intro' }
  | { kind: 'open' }
  | { kind: 'closed'; open: number }
  | { kind: 'result'; result: BalanceResult }
  | { kind: 'error' };

const SECONDS = motion.balance.seconds;
const SAMPLE_MS = 50;

/** Records the accelerometer while the countdown runs, then hands the samples over. */
function Stance({ label, onDone }: { label: string; onDone: (samples: Sample[]) => void }) {
  const t = useTexts(texts);
  const samples = useRef<Sample[]>([]);
  useEffect(() => {
    Accelerometer.setUpdateInterval(SAMPLE_MS);
    const subscription = Accelerometer.addListener((s) => samples.current.push(s));
    return () => subscription.remove();
  }, []);
  const { remaining } = useCountdown(SECONDS, true, () => onDone(samples.current));
  return (
    <View className="items-center gap-3">
      <Text role="heading" aria-level="3" className="text-title font-semibold">
        {label}
      </Text>
      <StepTimer total={SECONDS} remaining={remaining} size={180} />
      <Text className="text-muted-foreground text-body-sm">{t.stayStill}</Text>
    </View>
  );
}

export const BALANCE_LABEL: Record<Level, 'balanceGreen' | 'balanceAmber' | 'balanceRed'> = {
  green: 'balanceGreen',
  amber: 'balanceAmber',
  red: 'balanceRed',
  pending: 'balanceGreen',
};

export function BalanceTest() {
  const t = useTexts(texts);
  const { crewMember } = usePreferences();
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [failed, setFailed] = useState(false);

  const finish = async (open: number, closedSamples: Sample[]) => {
    const closed = swayMilliG(closedSamples);
    if (closed === undefined) {
      setPhase({ kind: 'error' });
      return;
    }
    const result = balanceResult({ open, closed }, motion);
    setPhase({ kind: 'result', result });
    try {
      await store.saveReading(
        balanceReading(
          { open, closed },
          { crewMember, takenAt: new Date().toISOString(), newId: randomUUID },
        ),
      );
      setFailed(false);
    } catch (error) {
      console.warn('[motion] balance save failed', error);
      setFailed(true);
    }
  };

  switch (phase.kind) {
    case 'open':
      return (
        <Stance
          key="open"
          label={t.eyesOpen}
          onDone={(samples) => {
            const open = swayMilliG(samples);
            setPhase(open === undefined ? { kind: 'error' } : { kind: 'closed', open });
          }}
        />
      );
    case 'closed':
      return (
        <Stance
          key="closed"
          label={t.eyesClosed}
          onDone={(samples) => void finish(phase.open, samples)}
        />
      );
    case 'result':
      return (
        <View className="gap-3">
          <LevelBadge level={phase.result.level} label={t[BALANCE_LABEL[phase.result.level]]} />
          <Text className="text-body-sm">
            {format(t.balanceResult, { open: phase.result.open, closed: phase.result.closed })}
          </Text>
          {failed ? <Text className="text-body-sm">{t.saveFailed}</Text> : null}
          <BigButton variant="ghost" label={t.again} onPress={() => setPhase({ kind: 'open' })} />
        </View>
      );
    default:
      return (
        <View className="gap-3">
          <Text className="text-muted-foreground text-body-sm">
            {phase.kind === 'error'
              ? t.balanceNoSensor
              : format(t.balanceIntro, { seconds: SECONDS })}
          </Text>
          <BigButton
            variant="secondary"
            label={t.balanceStart}
            onPress={() => setPhase({ kind: 'open' })}
          />
        </View>
      );
  }
}
