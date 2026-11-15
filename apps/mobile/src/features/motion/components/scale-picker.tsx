import { type Level, motion, motionLevel, motionReading } from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { BigButton, format, LEVEL_TEXT_CLASS } from '@/shared/components/haven';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { store, usePreferences } from '@/shared/data';
import { useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { texts } from '../i18n';

/** The 0–10 scale as a list: each row says what the number means. */
export function ScalePicker() {
  const t = useTexts(texts);
  const translate = useTranslate();
  const { crewMember } = usePreferences();
  const [value, setValue] = useState<string>('');
  const [result, setResult] = useState<string>();

  const save = async () => {
    if (value === '') return;
    try {
      await store.saveReading(
        motionReading(Number(value), {
          crewMember,
          takenAt: new Date().toISOString(),
          newId: randomUUID,
        }),
      );
      setResult(format(t.saved, { score: value }));
      setValue('');
    } catch (error) {
      console.warn('[motion] save failed', error);
      setResult(t.saveFailed);
    }
  };

  return (
    <View className="gap-4">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(next) => {
          setValue(next ?? '');
          setResult(undefined);
        }}
        accessibilityLabel={t.howDoYouFeel}
        className="border-border flex-col items-stretch overflow-hidden rounded-lg border"
      >
        {motion.scale.map((step, i) => {
          const selected = value === String(step.score);
          const level: Level = motionLevel(step.score, motion);
          const label = translate(step.label);
          return (
            <ToggleGroupItem
              key={step.score}
              value={String(step.score)}
              accessibilityLabel={`${step.score}: ${label}`}
              className={cn(
                'min-h-row h-auto justify-start gap-3 px-4 py-2 sm:h-auto sm:min-w-0 sm:px-4',
                i > 0 && 'border-border border-t',
                selected ? 'bg-brand-subtle active:bg-brand-subtle' : 'active:bg-active',
              )}
            >
              <Text
                className={cn('text-body w-6 font-semibold tabular-nums', LEVEL_TEXT_CLASS[level])}
              >
                {step.score}
              </Text>
              <Text className="text-body-sm text-foreground flex-1">{label}</Text>
              {selected ? (
                <Icon as={Check} size={18} strokeWidth={2} className="text-brand" />
              ) : null}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      <BigButton label={t.save} disabled={value === ''} onPress={() => void save()} />
      {result ? (
        <Text accessibilityLiveRegion="polite" className="text-muted-foreground text-body-sm">
          {result}
        </Text>
      ) : null}
    </View>
  );
}
