import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { format } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { MONO_FONT } from '@/shared/lib/theme';
import type { CognitionTexts } from '../i18n';
import {
  PVT_NO_RESPONSE_MS,
  PVT_TRIALS,
  type PvtResult,
  pvtDelay,
  type Random,
  scorePvt,
} from '../logic/battery';
import { clock, TestFrame } from './test-frame';

type Phase = 'waiting' | 'signal' | 'feedback';

type Props = {
  t: CognitionTexts;
  random: Random;
  onDone: (result: PvtResult) => void;
  onExit: () => void;
};

const FEEDBACK_MS = 700;

/** PVT: 5 trials; signal after a random 1.5–5 s; taps before it are false starts. */
export function PvtTest({ t, random, onDone, onExit }: Props) {
  const [trial, setTrial] = useState(0);
  const [phase, setPhase] = useState<Phase>('waiting');
  const [message, setMessage] = useState<string>(t.waitSignal);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAt = useRef(0);
  const rts = useRef<number[]>([]);
  const falseStarts = useRef(0);
  const phaseRef = useRef<Phase>('waiting');
  const finished = useRef(false);

  const set = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const record = (rt: number) => {
    clear();
    rts.current.push(rt);
    set('feedback');
    setMessage(format(t.ms, { n: Math.round(rt) }));
    timer.current = setTimeout(() => {
      if (rts.current.length >= PVT_TRIALS) {
        finished.current = true;
        onDone(scorePvt(rts.current, falseStarts.current));
      } else setTrial((n) => n + 1);
    }, FEEDBACK_MS);
  };

  const arm = () => {
    clear();
    set('waiting');
    timer.current = setTimeout(() => {
      shownAt.current = clock();
      set('signal');
      timer.current = setTimeout(() => record(PVT_NO_RESPONSE_MS), PVT_NO_RESPONSE_MS);
    }, pvtDelay(random));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: arms each trial once
  useEffect(() => {
    setMessage(t.waitSignal);
    arm();
    return clear;
  }, [trial]);

  const onPressIn = () => {
    if (finished.current) return;
    if (phaseRef.current === 'signal') record(clock() - shownAt.current);
    else if (phaseRef.current === 'waiting') {
      falseStarts.current += 1;
      setMessage(t.tooSoon);
      arm();
    }
  };

  return (
    <TestFrame
      label={`${format(t.test, { n: 1 })} · ${format(t.trial, { n: trial + 1, total: PVT_TRIALS })}`}
      progress={trial / PVT_TRIALS}
      exitLabel={t.exit}
      onExit={onExit}
    >
      <Button
        variant="ghost"
        onPressIn={onPressIn}
        accessibilityRole="button"
        accessibilityLabel={message}
        className="h-auto flex-1 flex-col items-center justify-center gap-8 rounded-none p-0 active:bg-transparent sm:h-auto"
      >
        <View className="border-border h-60 w-60 items-center justify-center rounded-lg border">
          {phase === 'signal' ? <View className="bg-foreground h-40 w-40 rounded-full" /> : null}
        </View>
        <Text
          className="text-body-sm text-muted-foreground group-active:text-muted-foreground text-center font-normal tabular-nums"
          style={{ fontFamily: MONO_FONT }}
        >
          {phase === 'signal' ? ' ' : message}
        </Text>
      </Button>
    </TestFrame>
  );
}
