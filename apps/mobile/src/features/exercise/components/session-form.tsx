import { type ExerciseKind, exercise, sessionReading } from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { View } from 'react-native';
import { BigButton, format, SegmentedControl } from '@/shared/components/haven';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Text } from '@/shared/components/ui/text';
import { store, usePreferences } from '@/shared/data';
import { useTexts, useTranslate } from '@/shared/i18n';
import { texts } from '../i18n';
import { parseMinutes } from '../logic/exercise';

const devicesOf = (kind: ExerciseKind) => exercise.devices.filter((d) => d.kind === kind);

export function SessionForm() {
  const t = useTexts(texts);
  const translate = useTranslate();
  const { crewMember } = usePreferences();
  const [kind, setKind] = useState<ExerciseKind>('resistance');
  const [device, setDevice] = useState(devicesOf('resistance')[0]?.id ?? '');
  // Uncontrolled field: React never writes over what is being typed; a new key clears it.
  const [field, setField] = useState(0);
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string }>();
  const minutes = parseMinutes(text, exercise);
  const [min, max] = exercise.limits.sessionMinutes;

  const choose = (next: ExerciseKind) => {
    setKind(next);
    setDevice(devicesOf(next)[0]?.id ?? '');
  };

  const save = async () => {
    if (minutes === undefined) return;
    try {
      await store.saveReading(
        sessionReading(
          kind,
          { minutes, ...(device ? { device } : {}) },
          { crewMember, takenAt: new Date().toISOString(), newId: randomUUID },
        ),
      );
      setResult({
        ok: true,
        message: format(t.saved, { n: minutes, kind: t[kind].toLowerCase() }),
      });
      setText('');
      setField((k) => k + 1);
    } catch (error) {
      console.warn('[exercise] save failed', error);
      setResult({ ok: false, message: t.saveFailed });
    }
  };

  const devices = devicesOf(kind);
  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-body-sm font-medium">{t.kind}</Text>
        <SegmentedControl
          accessibilityLabel={t.kind}
          value={kind}
          onChange={choose}
          options={[
            { value: 'resistance', label: t.resistance },
            { value: 'aerobic', label: t.aerobic },
          ]}
        />
      </View>
      {devices.length > 1 ? (
        <View className="gap-2">
          <Text className="text-body-sm font-medium">{t.device}</Text>
          <SegmentedControl
            accessibilityLabel={t.device}
            value={device}
            onChange={setDevice}
            options={devices.map((d) => ({ value: d.id, label: translate(d.name) }))}
          />
        </View>
      ) : devices[0] ? (
        <Text className="text-muted-foreground text-body-sm">{translate(devices[0].name)}</Text>
      ) : null}
      <View className="gap-2">
        <Label nativeID="exercise-minutes-label">{t.minutes}</Label>
        <Input
          key={field}
          aria-labelledby="exercise-minutes-label"
          keyboardType="number-pad"
          maxLength={3}
          defaultValue=""
          onChangeText={(v) => {
            setText(v);
            setResult(undefined);
          }}
          placeholder="45"
        />
        {text.length > 0 && minutes === undefined ? (
          <Text className="text-body-sm text-destructive">
            {format(t.minutesInvalid, { min, max })}
          </Text>
        ) : null}
      </View>
      <BigButton label={t.save} disabled={minutes === undefined} onPress={() => void save()} />
      {result ? (
        <Text
          accessibilityLiveRegion="polite"
          className={result.ok ? 'text-muted-foreground text-body-sm' : 'text-body-sm'}
        >
          {result.message}
        </Text>
      ) : null}
    </View>
  );
}
