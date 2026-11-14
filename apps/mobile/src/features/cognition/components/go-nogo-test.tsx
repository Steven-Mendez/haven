import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { format } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { MONO_FONT } from '@/shared/lib/theme';
import type { CognitionTexts } from '../i18n';
import {
  GO_NOGO_SLOT_MS,
  GO_NOGO_STIMULUS_MS,
  goNoGoSequence,
  type Random,
  scoreGoNoGo,
} from '../logic/battery';
import { TestFrame } from './test-frame';

type Props = {
  t: CognitionTexts;
  random: Random;
  onDone: (accuracy: number) => void;
  onExit: () => void;
};

export function GoNoGoTest({ t, random, onDone, onExit }: Props) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: one sequence per mount
  const sequence = useMemo(() => goNoGoSequence(random), []);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const tapped = useRef<boolean[]>([]);
  const current = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: one schedule per stimulus
  useEffect(() => {
    current.current = index;
    setVisible(true);
    const hide = setTimeout(() => setVisible(false), GO_NOGO_STIMULUS_MS);
    const next = setTimeout(() => {
      if (index + 1 >= sequence.length) onDone(scoreGoNoGo(sequence, tapped.current));
      else setIndex(index + 1);
    }, GO_NOGO_SLOT_MS);
    return () => {
      clearTimeout(hide);
      clearTimeout(next);
    };
  }, [index]);

  const stimulus = sequence[index];
  const onPressIn = () => {
    tapped.current[current.current] = true;
  };

  return (
    <TestFrame
      label={`${format(t.test, { n: 3 })} · ${Math.max(0, Math.ceil(((sequence.length - index) * GO_NOGO_SLOT_MS) / 1000))} s`}
      progress={index / sequence.length}
      exitLabel={t.exit}
      onExit={onExit}
    >
      <Button
        variant="ghost"
        onPressIn={onPressIn}
        accessibilityRole="button"
        accessibilityLabel={t.tapCircles}
        className="h-auto flex-1 flex-col items-center justify-center gap-8 rounded-none p-0 active:bg-transparent sm:h-auto"
      >
        <View className="border-border h-60 w-60 items-center justify-center rounded-lg border">
          {visible && stimulus ? (
            <View
              className={
                stimulus.kind === 'go'
                  ? 'bg-foreground h-40 w-40 rounded-full'
                  : 'bg-foreground h-36 w-36 rounded-none'
              }
            />
          ) : null}
        </View>
        <Text
          className="text-body-sm text-muted-foreground group-active:text-muted-foreground text-center font-normal"
          style={{ fontFamily: MONO_FONT }}
        >
          {t.tapCircles}
        </Text>
      </Button>
    </TestFrame>
  );
}
