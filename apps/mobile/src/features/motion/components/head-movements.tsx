import { motion } from '@haven/core';
import { useState } from 'react';
import { View } from 'react-native';
import {
  BigButton,
  format,
  SegmentedProgress,
  StepTimer,
  useCountdown,
} from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { useTexts, useTranslate } from '@/shared/i18n';
import { texts } from '../i18n';

const STEPS = motion.headMovements;

/** One step with its own countdown; a new key restarts it for the next step. */
function Step({ index, onNext }: { index: number; onNext: () => void }) {
  const t = useTexts(texts);
  const translate = useTranslate();
  const step = STEPS[index];
  const { remaining } = useCountdown(step?.seconds ?? 0, true);
  if (!step) return null;
  const last = index === STEPS.length - 1;
  return (
    <View className="gap-4">
      <SegmentedProgress total={STEPS.length} current={index} />
      <View className="gap-1">
        <Text className="text-tertiary text-caption">
          {format(t.stepOf, { n: index + 1, total: STEPS.length })}
        </Text>
        <Text role="heading" aria-level="3" className="text-body font-semibold">
          {translate(step.title)}
        </Text>
        <Text className="text-muted-foreground text-body-sm">{translate(step.body)}</Text>
      </View>
      <View className="items-center">
        <StepTimer total={step.seconds} remaining={remaining} size={160} />
      </View>
      <BigButton label={last ? t.finish : t.next} variant="secondary" onPress={onNext} />
    </View>
  );
}

export function HeadMovements() {
  const t = useTexts(texts);
  const [index, setIndex] = useState<number | 'done' | undefined>();
  if (index === undefined || index === 'done') {
    return (
      <View className="gap-3">
        <Text className="text-muted-foreground text-body-sm">
          {index === 'done' ? t.done : t.movementsIntro}
        </Text>
        <BigButton variant="secondary" label={t.start} onPress={() => setIndex(0)} />
      </View>
    );
  }
  return (
    <Step
      key={index}
      index={index}
      onNext={() => setIndex(index + 1 < STEPS.length ? index + 1 : 'done')}
    />
  );
}
