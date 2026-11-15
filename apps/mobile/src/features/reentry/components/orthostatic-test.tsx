import { orthostaticReadings, orthostaticResult, reentry, symptomById } from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  BigButton,
  format,
  formatClock,
  LevelBadge,
  StepTimer,
  useCountdown,
} from '@/shared/components/haven';
import { Icon } from '@/shared/components/ui/icon';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Text } from '@/shared/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { store, usePreferences, useReadings } from '@/shared/data';
import { useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { texts } from '../i18n';
import { nextPhase, parsePulse, recentWatchPulse, type TestPhase } from '../logic/flow';

const O = reentry.orthostatic;

function PulseStep({
  title,
  body,
  seconds,
  onNext,
}: {
  title: string;
  body: string;
  seconds: number;
  onNext: (pulse: number, fromWatch: boolean) => void;
}) {
  const t = useTexts(texts);
  const { remaining, done } = useCountdown(seconds, true);
  const heartRates = useReadings('heart-rate');
  const watchPulse = recentWatchPulse(heartRates, new Date());
  const [text, setText] = useState('');
  const [fromWatch, setFromWatch] = useState(false);
  const pulse = parsePulse(text);
  return (
    <View className="gap-6">
      <View className="gap-1">
        <Text role="heading" aria-level="2" className="text-title font-semibold">
          {title}
        </Text>
        <Text className="text-muted-foreground text-body">{body}</Text>
      </View>
      <StepTimer total={seconds} remaining={remaining} size={180} className="self-center" />
      <View className="gap-2">
        <Label nativeID="pulse-label">{t.pulse}</Label>
        <Input
          aria-labelledby="pulse-label"
          keyboardType="number-pad"
          value={text}
          onChangeText={(v) => {
            setText(v);
            setFromWatch(false);
          }}
          placeholder="72"
        />
        {text.length > 0 && pulse === undefined ? (
          <Text className="text-body-sm text-destructive">{t.pulseInvalid}</Text>
        ) : null}
        {watchPulse !== undefined ? (
          <BigButton
            variant="ghost"
            label={format(t.useWatch, { n: watchPulse })}
            onPress={() => {
              setText(String(watchPulse));
              setFromWatch(true);
            }}
          />
        ) : null}
        {!done ? (
          <Text className="text-tertiary text-caption">
            {`${t.waitHint} ${formatClock(remaining)}`}
          </Text>
        ) : null}
      </View>
      <BigButton
        label={t.next}
        disabled={pulse === undefined}
        onPress={() => pulse !== undefined && onNext(pulse, fromWatch)}
      />
    </View>
  );
}

export function OrthostaticTest({ onClose }: { onClose: () => void }) {
  const t = useTexts(texts);
  const translate = useTranslate();
  const { crewMember } = usePreferences();
  const [phase, setPhase] = useState<TestPhase>('intro');
  const [supine, setSupine] = useState<{ pulse: number; at: string } | null>(null);
  const [standing, setStanding] = useState<number | null>(null);
  const [watchUsed, setWatchUsed] = useState(false);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const advance = () => setPhase((p) => nextPhase(p));

  const result = useMemo(
    () =>
      supine && standing !== null
        ? orthostaticResult(supine.pulse, standing, symptoms, reentry)
        : undefined,
    [supine, standing, symptoms],
  );

  const save = async () => {
    if (!result || !supine || saving) return;
    setSaving(true);
    try {
      await store.saveReadings(
        orthostaticReadings(result, {
          crewMember,
          takenAt: new Date().toISOString(),
          supineAt: supine.at,
          newId: randomUUID,
          source: watchUsed ? 'watch' : 'manual',
        }),
      );
      onClose();
    } catch (error) {
      console.warn('[reentry] save failed', error);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  switch (phase) {
    case 'intro':
      return (
        <View className="gap-6">
          <View className="gap-1">
            <Text role="heading" aria-level="2" className="text-title font-semibold">
              {t.introTitle}
            </Text>
            <Text className="text-muted-foreground text-body">
              {format(t.introBody, {
                supine: formatClock(O.supineSeconds),
                standing: formatClock(O.standingSeconds),
              })}
            </Text>
          </View>
          <BigButton label={t.begin} onPress={advance} />
          <BigButton label={t.cancel} variant="ghost" onPress={onClose} />
        </View>
      );
    case 'supine':
      return (
        <PulseStep
          key="supine"
          title={t.supineTitle}
          body={t.supineBody}
          seconds={O.supineSeconds}
          onNext={(pulse, fromWatch) => {
            setSupine({ pulse, at: new Date().toISOString() });
            setWatchUsed(fromWatch);
            advance();
          }}
        />
      );
    case 'standing':
      return (
        <PulseStep
          key="standing"
          title={t.standingTitle}
          body={t.standingBody}
          seconds={O.standingSeconds}
          onNext={(pulse, fromWatch) => {
            setStanding(pulse);
            setWatchUsed((used) => used && fromWatch);
            advance();
          }}
        />
      );
    case 'symptoms':
      return (
        <View className="gap-6">
          <View className="gap-1">
            <Text role="heading" aria-level="2" className="text-title font-semibold">
              {t.symptomsTitle}
            </Text>
            <Text className="text-muted-foreground text-body">{t.symptomsBody}</Text>
          </View>
          <ToggleGroup
            type="multiple"
            value={symptoms}
            onValueChange={(next) => setSymptoms(next ?? [])}
            className="border-border flex-col items-stretch overflow-hidden rounded-lg border"
          >
            {O.symptoms.map((id, i) => {
              const selected = symptoms.includes(id);
              const name = translate(symptomById(id)?.name) || id;
              return (
                <ToggleGroupItem
                  key={id}
                  value={id}
                  accessibilityLabel={name}
                  className={cn(
                    'min-h-row h-auto justify-start gap-3 px-4 sm:h-auto sm:min-w-0 sm:px-4',
                    i > 0 && 'border-border border-t',
                    selected ? 'bg-brand-subtle active:bg-brand-subtle' : 'active:bg-active',
                  )}
                >
                  <Text className="text-body-sm text-foreground flex-1 font-medium">{name}</Text>
                  {selected ? (
                    <Icon as={Check} size={18} strokeWidth={2} className="text-brand" />
                  ) : null}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <BigButton label={symptoms.length ? t.next : t.noneFelt} onPress={advance} />
        </View>
      );
    case 'result':
      if (!result) return null;
      return (
        <View className="gap-6">
          <View className="gap-3">
            <Text role="heading" aria-level="2" className="text-title font-semibold">
              {t.resultTitle}
            </Text>
            <LevelBadge level={result.level} size="lg" />
            <Text className="text-body font-medium">{format(t.rise, { rise: result.rise })}</Text>
            <Text className="text-muted-foreground text-body">
              {result.level === 'red'
                ? t.resultRed
                : result.level === 'amber'
                  ? t.resultAmber
                  : t.resultGreen}
            </Text>
          </View>
          {failed ? <Text className="text-body">{t.saveFailed}</Text> : null}
          <BigButton label={t.save} loading={saving} onPress={() => void save()} />
          <BigButton label={t.cancel} variant="ghost" onPress={onClose} />
        </View>
      );
  }
}
