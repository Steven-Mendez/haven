import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { BottomSheet } from '@/shared/components/bottom-sheet';
import { ActivityRings, format, RingSpark } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { DialogClose } from '@/shared/components/ui/dialog';
import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { texts } from '../i18n';

type Milestone = { kind: 'streak' | 'mission'; value: number };

export function MilestoneSheet({
  milestone,
  onClose,
}: {
  milestone: Milestone | null;
  onClose: () => void;
}) {
  const t = useTexts(texts);
  useEffect(() => {
    if (milestone && Platform.OS !== 'web')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [milestone]);
  if (!milestone) return null;
  const title =
    milestone.kind === 'streak'
      ? format(t.milestoneStreak, { n: milestone.value })
      : format(t.milestoneMission, { n: milestone.value });
  const body =
    milestone.kind === 'streak'
      ? format(t.milestoneBody, { n: milestone.value })
      : format(t.milestoneMissionBody, { n: milestone.value });
  return (
    <BottomSheet open onClose={onClose} className="items-center gap-5 px-6">
      <ActivityRings
        rings={[{ id: 'routine', done: 1, total: 1 }]}
        size={140}
        accessibilityLabel={title}
      >
        <RingSpark size={28} />
      </ActivityRings>
      <View className="items-center gap-2">
        <Text role="heading" className="text-display text-center font-bold tabular-nums">
          {title}
        </Text>
        <Text className="text-muted-foreground text-body-sm text-center">{body}</Text>
      </View>
      <DialogClose asChild>
        <Button className="min-h-button h-auto w-full rounded-full py-0 active:opacity-85 sm:h-auto">
          <Text className="text-primary-foreground text-body font-semibold">
            {t.milestoneClose}
          </Text>
        </Button>
      </DialogClose>
    </BottomSheet>
  );
}
