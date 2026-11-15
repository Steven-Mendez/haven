import { assessmentReading, type ExerciseCompletion, type ExercisePain } from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { View } from 'react-native';
import { BigButton, SegmentedControl } from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { store, usePreferences } from '@/shared/data';
import { useTexts } from '@/shared/i18n';
import { texts } from '../i18n';

const EFFORT = Array.from({ length: 11 }, (_, i) => String(i));

export function AssessmentForm() {
  const t = useTexts(texts);
  const { crewMember } = usePreferences();
  const [effort, setEffort] = useState<string>();
  const [pain, setPain] = useState<ExercisePain>('none');
  const [completion, setCompletion] = useState<ExerciseCompletion>('full');
  const [failed, setFailed] = useState(false);

  const send = async () => {
    if (effort === undefined) return;
    try {
      await store.saveReading(
        assessmentReading(
          { effort: Number(effort), pain, completion },
          { crewMember, takenAt: new Date().toISOString(), newId: randomUUID },
        ),
      );
      setFailed(false);
    } catch (error) {
      console.warn('[exercise] assessment save failed', error);
      setFailed(true);
    }
  };

  return (
    <View className="gap-5">
      <Text className="text-muted-foreground text-body">{t.assessmentIntro}</Text>
      <View className="gap-2">
        <Text className="text-body-sm font-medium">{t.effort}</Text>
        <SegmentedControl
          accessibilityLabel={t.effort}
          // An empty value leaves every segment unselected until the crew member picks one.
          value={effort ?? ''}
          onChange={setEffort}
          options={EFFORT.map((v) => ({ value: v, label: v }))}
        />
        <Text className="text-tertiary text-caption">{t.effortHint}</Text>
      </View>
      <View className="gap-2">
        <Text className="text-body-sm font-medium">{t.pain}</Text>
        <SegmentedControl
          accessibilityLabel={t.pain}
          value={pain}
          onChange={setPain}
          options={[
            { value: 'none', label: t.painNone },
            { value: 'mild', label: t.painMild },
            { value: 'strong', label: t.painStrong },
          ]}
        />
      </View>
      <View className="gap-2">
        <Text className="text-body-sm font-medium">{t.completion}</Text>
        <SegmentedControl
          accessibilityLabel={t.completion}
          value={completion}
          onChange={setCompletion}
          options={[
            { value: 'full', label: t.completionFull },
            { value: 'partial', label: t.completionPartial },
            { value: 'none', label: t.completionNone },
          ]}
        />
      </View>
      <BigButton
        label={t.sendAssessment}
        disabled={effort === undefined}
        onPress={() => void send()}
      />
      {failed ? <Text className="text-body-sm">{t.saveFailed}</Text> : null}
    </View>
  );
}
