import { dailyProgress, type Packet } from '@haven/core';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { BigButton, format, Section } from '@/shared/components/haven';
import { showToast } from '@/shared/components/toast';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { store, useAssessments, useMission, usePreferences, useReadings } from '@/shared/data';
import { useTexts } from '@/shared/i18n';
import { texts } from '../i18n';
import {
  applyExclusions,
  composeRoutinePacket,
  DEFAULT_EXCLUSIONS,
  type Exclusions,
  summarize,
} from '../logic/compose';
import { enqueueRoutine, newPacketId } from '../service';

type Props = { onDone: () => void };

function ToggleRow({
  id,
  label,
  count,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  count: number;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View className="min-h-row flex-row items-center gap-3 px-4 py-2">
      <View className="min-w-0 flex-1">
        <Label nativeID={id} onPress={() => onChange(!checked)} className="text-body-sm flex-1">
          {label}
        </Label>
      </View>
      <Text className="text-tertiary text-caption tabular-nums">{count}</Text>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-labelledby={id}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function RoutineComposer({ onDone }: Props) {
  const t = useTexts(texts);
  const mission = useMission();
  const { crewMember } = usePreferences();
  const assessments = useAssessments();
  const readings = useReadings();
  const [exclusions, setExclusions] = useState<Exclusions>(DEFAULT_EXCLUSIONS);
  const [sending, setSending] = useState(false);

  const draft: Packet = useMemo(() => {
    const now = new Date();
    return composeRoutinePacket({
      id: 'preview',
      mission,
      crewMember,
      assessments,
      readings,
      dailyProgress: dailyProgress(readings, config, now),
      now,
    });
  }, [mission, crewMember, assessments, readings]);

  const all = summarize(draft);
  const kept = summarize(applyExclusions(draft, exclusions));
  const set = (key: keyof Exclusions) => (include: boolean) =>
    setExclusions((current) => ({ ...current, [key]: !include }));

  async function send() {
    setSending(true);
    try {
      const now = new Date();
      const packet = composeRoutinePacket({
        id: newPacketId(),
        mission: store.mission(),
        crewMember,
        assessments: store.assessments(),
        readings: store.readings(),
        dailyProgress: dailyProgress(store.readings(), config, now),
        now,
      });
      await enqueueRoutine(packet, exclusions);
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(store.mission().linkDown ? t.sentLaterToast : t.sentToast);
      onDone();
    } finally {
      setSending(false);
    }
  }

  return (
    <Section title={t.composeSection}>
      <Text className="text-muted-foreground text-body-sm">{t.composeHint}</Text>
      <View className="border-border overflow-hidden rounded-lg border">
        <View className="min-h-row justify-center px-4 py-3">
          <Text className="text-body-sm tabular-nums">
            {format(t.summaryLine, {
              r: kept.readings - kept.mood,
              a: kept.assessments,
              z: kept.zones,
              code: mission.code,
            })}
          </Text>
        </View>
        <View className="bg-border ml-4 h-px" />
        <ToggleRow
          id="include-notes"
          label={t.includeNotes}
          count={all.notes}
          checked={!exclusions.notes}
          onChange={set('notes')}
        />
        <View className="bg-border ml-4 h-px" />
        <ToggleRow
          id="include-mood"
          label={t.includeMood}
          count={all.mood}
          checked={!exclusions.mood}
          onChange={set('mood')}
        />
        <View className="bg-border ml-4 h-px" />
        <ToggleRow
          id="include-diary"
          label={t.includeDiary}
          count={all.diary}
          checked={!exclusions.diary}
          onChange={set('diary')}
        />
      </View>
      <BigButton label={t.send} loading={sending} onPress={send} />
      <Button
        variant="outline"
        className="min-h-button h-auto self-stretch rounded-full"
        onPress={onDone}
      >
        <Text>{t.cancel}</Text>
      </Button>
    </Section>
  );
}
