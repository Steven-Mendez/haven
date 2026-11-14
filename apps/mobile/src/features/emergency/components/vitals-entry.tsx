import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { BigButton, format, useUnitLabel } from '@/shared/components/haven';
import { Card } from '@/shared/components/ui/card';
import { Icon } from '@/shared/components/ui/icon';
import { Input } from '@/shared/components/ui/input';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { texts } from '../i18n';
import { isInvalidVital, VITAL_IDS, type VitalId } from '../logic/vitals';

type Props = {
  onSave: (values: Partial<Record<VitalId, string>>) => number;
};

export function VitalsEntry({ onSave }: Props) {
  const t = useTexts(texts);
  const tr = useTranslate();
  const unitOf = useUnitLabel();
  const [values, setValues] = useState<Partial<Record<VitalId, string>>>({});
  const [saved, setSaved] = useState(0);
  const filled = VITAL_IDS.some((id) => (values[id] ?? '').trim() !== '');
  const invalid = VITAL_IDS.some((id) => isInvalidVital(id, values[id] ?? ''));

  return (
    <Card className="gap-3 rounded-lg p-4">
      <View className="flex-row flex-wrap gap-3">
        {VITAL_IDS.map((id) => {
          const indicator = config.indicators.find((i) => i.id === id);
          const name = tr(indicator?.name) || id;
          const bad = isInvalidVital(id, values[id] ?? '');
          return (
            <View key={id} className="min-w-[45%] flex-1 gap-1">
              <Text nativeID={`vital-${id}`} className="text-muted-foreground text-sm">
                {`${name} (${unitOf(indicator?.unit ?? '')})`}
              </Text>
              <Input
                aria-labelledby={`vital-${id}`}
                accessibilityLabel={name}
                keyboardType="decimal-pad"
                inputMode="decimal"
                returnKeyType="done"
                value={values[id] ?? ''}
                onChangeText={(text) => {
                  setValues((v) => ({ ...v, [id]: text }));
                  setSaved(0);
                }}
                className={cn(
                  'min-h-touch text-subtitle h-auto tabular-nums',
                  bad && 'border-level-amber',
                )}
              />
            </View>
          );
        })}
      </View>
      {invalid ? <Text className="text-level-amber text-sm">{t.vitalsInvalid}</Text> : null}
      {saved > 0 ? (
        <View className="flex-row items-center gap-2">
          <Icon as={Check} size={18} className="text-muted-foreground" />
          <Text className="text-muted-foreground text-sm">
            {format(t.vitalsSaved, { n: saved })}
          </Text>
        </View>
      ) : null}
      <BigButton
        label={t.vitalsSave}
        variant="secondary"
        disabled={!filled || invalid}
        onPress={() => {
          const n = onSave(values);
          if (n > 0) {
            setSaved(n);
            setValues({});
          }
        }}
      />
    </Card>
  );
}
