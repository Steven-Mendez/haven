import type { Reading } from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { Check, ChevronDown, ChevronRight } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  ageText,
  DataLabel,
  format,
  havenTexts,
  ScaleInput,
  type ScaleValue,
  SegmentedProgress,
} from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { store, useAgeMin } from '@/shared/data';
import { useTexts } from '@/shared/i18n';
import { texts } from '../i18n';
import { CHECKIN_UNDO_MS, scaleReadings } from '../logic/routine';

const unitOf = (id: string) => config.indicators.find((i) => i.id === id)?.unit ?? '';

type Props = {
  crewMember: string;
  today?: { mood: Reading; stress: Reading };
  /** "Not now" button from Routine, shown inside the card. */
  later?: ReactNode;
};

export function CheckinCard({ crewMember, today, later }: Props) {
  const t = useTexts(texts);
  const h = useTexts(havenTexts);
  const [mood, setMood] = useState<ScaleValue | null>(null);
  const [stress, setStress] = useState<ScaleValue | null>(null);
  const [again, setAgain] = useState(false);
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(0);
  const pending = useRef<{ mood: number; stress: number } | null>(null);
  const ageMin = useAgeMin(today?.mood.takenAt);

  const commit = () => {
    const values = pending.current;
    pending.current = null;
    setLeft(0);
    if (!values) return;
    void store.saveReadings(
      scaleReadings(values.mood, values.stress, {
        crewMember,
        takenAt: new Date().toISOString(),
        newId: randomUUID,
        unitOf,
      }),
    );
    setMood(null);
    setStress(null);
    setAgain(false);
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    if (!mood || !stress) return;
    pending.current = { mood, stress };
    const end = Date.now() + CHECKIN_UNDO_MS;
    setLeft(Math.ceil(CHECKIN_UNDO_MS / 1000));
    const tick = setInterval(() => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 250);
    const done = setTimeout(() => commitRef.current(), CHECKIN_UNDO_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [mood, stress]);
  useEffect(() => () => commitRef.current(), []);

  const undo = () => {
    pending.current = null;
    setLeft(0);
    setMood(null);
    setStress(null);
  };

  const moodLabel = (v: number) => [h.mood1, h.mood2, h.mood3, h.mood4, h.mood5][v - 1];
  const stressLabel = (v: number) => [h.stress1, h.stress2, h.stress3, h.stress4, h.stress5][v - 1];
  const journalLink = (
    <Button
      variant="link"
      className="min-h-touch h-auto self-start px-0 sm:h-auto"
      onPress={() => router.push('/wellbeing')}
    >
      <Text className="text-link text-body-sm font-medium">{t.addJournal}</Text>
    </Button>
  );

  if (today && !again && !pending.current) {
    return (
      <Collapsible open={open} onOpenChange={setOpen} className="border-border rounded-lg border">
        <CollapsibleTrigger className="min-h-row active:bg-active flex-row items-center gap-3 px-4 py-2">
          <Icon as={Check} size={18} strokeWidth={2} className="text-brand" />
          <View className="flex-1 gap-0.5">
            <Text className="text-body-sm font-medium" numberOfLines={1}>
              {t.mood}: {moodLabel(Number(today.mood.value))} · {t.stress}:{' '}
              {stressLabel(Number(today.stress.value))}
            </Text>
            <Text className="text-tertiary text-caption tabular-nums">{ageText(h, ageMin)}</Text>
          </View>
          <Icon as={open ? ChevronDown : ChevronRight} size={16} className="text-tertiary" />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-border gap-1 border-t px-4 pt-2 pb-2">
          <DataLabel source={today.mood.source} ageMin={ageMin} />
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            {journalLink}
            <Button
              variant="outline"
              className="min-h-touch h-auto rounded-full px-4 sm:h-auto"
              onPress={() => setAgain(true)}
            >
              <Text className="text-body-sm font-medium">{t.again}</Text>
            </Button>
          </View>
        </CollapsibleContent>
        {later ? <View className="px-4 pb-3">{later}</View> : null}
      </Collapsible>
    );
  }

  const step = mood && stress ? 2 : mood ? 1 : 0;
  return (
    <View className="border-border gap-5 rounded-lg border p-4">
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-muted-foreground text-micro font-semibold uppercase">
            {t.checkinTitle}
          </Text>
          <Text className="text-tertiary text-caption tabular-nums">
            {format(h.stepOf, { n: Math.min(step + 1, 2), total: 2 })}
          </Text>
        </View>
        <SegmentedProgress total={2} current={step} />
      </View>
      {step === 0 ? (
        <ScaleInput kind="mood" title={t.mood} value={mood} onChange={setMood} />
      ) : (
        <ScaleInput kind="stress" title={t.stress} value={stress} onChange={setStress} />
      )}
      {left > 0 ? (
        <View className="min-h-touch flex-row items-center justify-between gap-2">
          <Text className="text-body-sm tabular-nums" accessibilityLiveRegion="polite">
            {format(t.savingIn, { n: left })}
          </Text>
          <Button
            variant="outline"
            className="min-h-touch h-auto rounded-full px-4 sm:h-auto"
            onPress={undo}
          >
            <Text className="text-body-sm font-medium">{t.undo}</Text>
          </Button>
        </View>
      ) : step === 1 ? (
        <Button
          variant="ghost"
          className="min-h-touch h-auto self-start rounded-full px-0 sm:h-auto"
          onPress={() => setMood(null)}
        >
          <Text className="text-link text-body-sm font-medium">
            {`${t.mood}: ${moodLabel(mood as number)} · ${h.undo}`}
          </Text>
        </Button>
      ) : (
        <Text className="text-tertiary text-caption">{t.checkinHint}</Text>
      )}
      {journalLink}
      {later}
    </View>
  );
}
