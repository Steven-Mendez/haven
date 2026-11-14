import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { format } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { MONO_FONT } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';
import type { CognitionTexts } from '../i18n';
import {
  GRID_CELLS,
  GRID_SIZE,
  isRecallCorrect,
  MEMORY_MIN_LEVEL,
  MEMORY_TRIALS,
  type MemoryTrial,
  memoryPattern,
  memoryShowMs,
  nextMemoryLevel,
  type Random,
  scoreMemory,
} from '../logic/battery';
import { TestFrame } from './test-frame';

/** Recall window per trial; without all taps by then the trial is a miss. */
export const RECALL_LIMIT_MS = 10_000;
const BETWEEN_MS = 600;

type Phase = 'show' | 'recall' | 'between';

type Props = {
  t: CognitionTexts;
  random: Random;
  onDone: (score: number) => void;
  onExit: () => void;
};

/** Spatial working memory on a 4×4 grid (cells ≥ 64 pt), adaptive from 3 to 5 cells. */
export function MemoryTest({ t, random, onDone, onExit }: Props) {
  const [trial, setTrial] = useState(0);
  const [level, setLevel] = useState(MEMORY_MIN_LEVEL);
  const [pattern, setPattern] = useState<number[]>([]);
  const [taps, setTaps] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>('show');
  const results = useRef<MemoryTrial[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const finishTrial = (correct: boolean, lvl: number) => {
    clear();
    results.current.push({ level: lvl, correct });
    setPhase('between');
    timer.current = setTimeout(() => {
      if (results.current.length >= MEMORY_TRIALS) onDone(scoreMemory(results.current));
      else {
        setLevel(nextMemoryLevel(lvl, correct));
        setTrial((n) => n + 1);
      }
    }, BETWEEN_MS);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: one schedule per trial
  useEffect(() => {
    const p = memoryPattern(level, random);
    setPattern(p);
    setTaps([]);
    setPhase('show');
    timer.current = setTimeout(() => {
      setPhase('recall');
      timer.current = setTimeout(() => finishTrial(false, level), RECALL_LIMIT_MS);
    }, memoryShowMs(level));
    return clear;
  }, [trial]);

  const tap = (cell: number) => {
    if (phase !== 'recall' || taps.includes(cell)) return;
    const next = [...taps, cell];
    setTaps(next);
    if (next.length >= pattern.length) finishTrial(isRecallCorrect(pattern, next), level);
  };

  return (
    <TestFrame
      label={`${format(t.test, { n: 2 })} · ${format(t.trial, { n: trial + 1, total: MEMORY_TRIALS })}`}
      progress={trial / MEMORY_TRIALS}
      exitLabel={t.exit}
      onExit={onExit}
    >
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <Text
          className="text-body-sm text-muted-foreground text-center"
          style={{ fontFamily: MONO_FONT }}
          accessibilityLiveRegion="polite"
        >
          {phase === 'show'
            ? t.memorize
            : phase === 'recall'
              ? format(t.recall, { n: level })
              : ' '}
        </Text>
        <View className="border-border aspect-square w-full max-w-[400px] flex-row flex-wrap rounded-lg border p-2">
          {Array.from({ length: GRID_CELLS }, (_, cell) => {
            const lit = phase === 'show' && pattern.includes(cell);
            const tapped = phase !== 'show' && taps.includes(cell);
            return (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed 16-cell grid, the index is the cell id
                key={cell}
                style={{ width: `${100 / GRID_SIZE}%` }}
                className="aspect-square p-1"
              >
                <Button
                  variant="ghost"
                  onPressIn={() => tap(cell)}
                  disabled={phase !== 'recall'}
                  accessibilityRole="button"
                  accessibilityLabel={format(t.cell, { n: cell + 1 })}
                  accessibilityState={{ selected: tapped }}
                  // Neutralise Button's look: no fixed height, padding, pressed fill or disabled fade.
                  className={cn(
                    'min-h-touch-lg h-auto flex-1 rounded-md border p-0 opacity-100 sm:h-auto',
                    lit || tapped
                      ? 'bg-foreground border-foreground active:bg-foreground'
                      : 'border-border bg-transparent active:bg-transparent',
                  )}
                />
              </View>
            );
          })}
        </View>
      </View>
    </TestFrame>
  );
}
