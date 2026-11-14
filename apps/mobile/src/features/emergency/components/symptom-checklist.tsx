import { symptomById } from '@haven/core';
import { Check, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { format } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Icon } from '@/shared/components/ui/icon';
import { Separator } from '@/shared/components/ui/separator';
import { Text } from '@/shared/components/ui/text';
import { useTexts, useTranslate } from '@/shared/i18n';
import { texts } from '../i18n';
import { SYMPTOM_LIST, type Symptom } from '../logic/packet';

const FIRST: readonly Symptom[] = [
  'chest-pain',
  'sweating',
  'shortness-of-breath',
  'dizziness',
  'fainting',
];

type Props = {
  marked: Symptom[];
  onMark: (symptom: Symptom) => void;
};

export function SymptomChecklist({ marked, onMark }: Props) {
  const t = useTexts(texts);
  const tr = useTranslate();
  const [all, setAll] = useState(false);
  const list = all
    ? [...FIRST, ...SYMPTOM_LIST.filter((s) => !FIRST.includes(s))]
    : FIRST.filter((s) => SYMPTOM_LIST.includes(s));

  return (
    <View className="gap-2">
      <Card className="rounded-lg px-1 py-1">
        {list.map((symptom, i) => {
          const on = marked.includes(symptom);
          const name = tr(symptomById(symptom)?.name) || symptom;
          return (
            <View key={symptom}>
              {i > 0 ? <Separator /> : null}
              <Button
                variant="ghost"
                onPress={() => {
                  if (!on) onMark(symptom);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={name}
                className="min-h-row h-auto justify-start gap-3 px-3"
              >
                <Icon
                  as={on ? Check : Plus}
                  size={20}
                  className={on ? 'text-foreground' : 'text-muted-foreground'}
                />
                <Text className={on ? 'text-body font-semibold' : 'text-body'}>{name}</Text>
              </Button>
            </View>
          );
        })}
      </Card>
      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground text-sm">
          {marked.length > 0 ? format(t.symptomsMarked, { n: marked.length }) : t.symptomsHint}
        </Text>
        {all ? null : (
          <Button variant="link" onPress={() => setAll(true)} className="min-h-touch h-auto px-2">
            <Text className="text-link text-sm font-semibold">
              {format(t.seeAll, { n: SYMPTOM_LIST.length })}
            </Text>
          </Button>
        )}
      </View>
    </View>
  );
}
