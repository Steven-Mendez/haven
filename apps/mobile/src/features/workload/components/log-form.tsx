import {
  fatigueLevel,
  fatigueReading,
  parseWorkHours,
  workHoursReading,
  workload,
} from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { BigButton, LEVEL_TEXT_CLASS } from '@/shared/components/haven';
import { Icon } from '@/shared/components/ui/icon';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Text } from '@/shared/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { store, usePreferences } from '@/shared/data';
import { useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { texts } from '../i18n';

/** Today's hours and fatigue; either one can be saved on its own. */
export function LogForm() {
  const t = useTexts(texts);
  const translate = useTranslate();
  const { crewMember } = usePreferences();
  // Uncontrolled field: React never writes over what is being typed; a new key clears it.
  const [field, setField] = useState(0);
  const [text, setText] = useState('');
  const [fatigue, setFatigue] = useState('');
  const [result, setResult] = useState<string>();
  const hours = parseWorkHours(text);
  const invalid = text.trim().length > 0 && hours === undefined;
  const ready = !invalid && (hours !== undefined || fatigue !== '');

  const save = async () => {
    const options = { crewMember, takenAt: new Date().toISOString(), newId: randomUUID };
    try {
      if (hours !== undefined) await store.saveReading(workHoursReading(hours, options));
      if (fatigue !== '') await store.saveReading(fatigueReading(Number(fatigue), options));
      setResult(t.saved);
      setText('');
      setFatigue('');
      setField((k) => k + 1);
    } catch (error) {
      console.warn('[workload] save failed', error);
      setResult(t.saveFailed);
    }
  };

  return (
    <View className="gap-5">
      <View className="gap-2">
        <Label nativeID="work-hours-label">{t.hours}</Label>
        <Input
          key={field}
          aria-labelledby="work-hours-label"
          keyboardType="decimal-pad"
          maxLength={4}
          defaultValue=""
          onChangeText={(v) => {
            setText(v);
            setResult(undefined);
          }}
          placeholder="8"
        />
        <Text className={cn('text-caption', invalid ? 'text-destructive' : 'text-tertiary')}>
          {invalid ? t.hoursInvalid : t.hoursHint}
        </Text>
      </View>
      <View className="gap-2">
        <Text className="text-body-sm font-medium">{t.fatigue}</Text>
        <ToggleGroup
          type="single"
          value={fatigue}
          onValueChange={(next) => {
            setFatigue(next ?? '');
            setResult(undefined);
          }}
          accessibilityLabel={t.fatigue}
          className="border-border flex-col items-stretch overflow-hidden rounded-lg border"
        >
          {workload.fatigueScale.map((step, i) => {
            const selected = fatigue === String(step.score);
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
                  className={cn(
                    'text-body w-6 font-semibold tabular-nums',
                    LEVEL_TEXT_CLASS[fatigueLevel(step.score, workload)],
                  )}
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
      </View>
      <BigButton label={t.save} disabled={!ready} onPress={() => void save()} />
      {result ? (
        <Text accessibilityLiveRegion="polite" className="text-muted-foreground text-body-sm">
          {result}
        </Text>
      ) : null}
    </View>
  );
}
