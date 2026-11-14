import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { View } from 'react-native';
import { HoldToConfirm, ListGroup } from '@/shared/components/haven';
import { useScreenInsets } from '@/shared/components/screen';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { useMission, usePreferences } from '@/shared/data';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { texts } from '../i18n';

function ContextRow({ label, value, dot }: { label: string; value: string; dot?: boolean }) {
  return (
    <View className="min-h-row-settings flex-row items-center gap-3 px-4 py-2">
      <Text className="text-muted-foreground text-body-sm flex-1">{label}</Text>
      {dot !== undefined ? (
        <View
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            dot ? 'bg-level-green' : 'border-muted-foreground border',
          )}
        />
      ) : null}
      <Text className="text-body-sm max-w-[60%] text-right font-medium" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function ArmView({ onConfirm }: { onConfirm: () => void }) {
  const t = useTexts(texts);
  const insets = useScreenInsets({ header: false });
  const mission = useMission();
  const { crewMember } = usePreferences();
  const crewName = mission.crew.find((c) => c.id === crewMember)?.name ?? t.crewMemberFallback;
  const cancel = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View
      className="bg-background flex-1 px-4"
      style={{ paddingTop: insets.top + 4, paddingBottom: insets.raw.bottom + 12 }}
    >
      <View className="flex-row items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          accessibilityRole="button"
          accessibilityLabel={t.cancelHold}
          onPress={cancel}
          className="h-touch w-touch sm:h-touch sm:w-touch border-border rounded-full active:bg-transparent active:opacity-70"
        >
          <Icon as={X} size={20} className="text-foreground" />
        </Button>
        <View className="flex-row items-center gap-2">
          <View className="bg-destructive h-2 w-2 rounded-full" />
          <Text className="text-muted-foreground text-micro font-semibold uppercase">
            {t.title}
          </Text>
        </View>
        <View className="w-touch" />
      </View>

      <View className="flex-1 items-center justify-center gap-6">
        <Text role="heading" className="text-title text-center font-bold">
          {t.holdTitle}
        </Text>
        <HoldToConfirm
          label={t.holdButton}
          hint={t.holdDetail}
          accessibilityLabel={t.startEmergency}
          onConfirm={onConfirm}
          size={220}
        />
      </View>

      <View className="gap-3">
        <ListGroup>
          <ContextRow label={t.contextCrew} value={crewName} />
          <ContextRow
            label={t.contextLink}
            value={
              mission.linkDown ? t.linkDownShort : `${Math.round(mission.currentDelayMin)} min`
            }
            dot={!mission.linkDown}
          />
          <ContextRow label={t.contextOnBoard} value={t.contextOnBoardValue} />
        </ListGroup>
        <Button
          variant="outline"
          accessibilityRole="button"
          onPress={cancel}
          className="min-h-button border-border-strong h-auto rounded-full px-0 py-0 active:bg-transparent active:opacity-70 sm:h-auto"
        >
          <Text className="text-body font-semibold">{t.cancelHold}</Text>
        </Button>
      </View>
    </View>
  );
}
