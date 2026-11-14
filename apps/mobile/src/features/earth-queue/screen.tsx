import { Inbox, WifiOff } from 'lucide-react-native';
import { Fragment } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, format, Section } from '@/shared/components/haven';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { useMission, usePreferences } from '@/shared/data';
import { useTexts } from '@/shared/i18n';
import { QueueRow } from './components/queue-row';
import { texts } from './i18n';
import { type DisplayStatus, displayStatus, pendingCount } from './logic/queue';
import { discard, retryNow, useOnline, useQueue, useSending } from './service';

type GroupTitle = 'groupQueued' | 'groupSending' | 'groupRejected' | 'groupReceived';
const GROUPS: { status: DisplayStatus; title: GroupTitle }[] = [
  { status: 'sending', title: 'groupSending' },
  { status: 'queued', title: 'groupQueued' },
  { status: 'rejected', title: 'groupRejected' },
  { status: 'received', title: 'groupReceived' },
];

export default function Screen() {
  const t = useTexts(texts);
  const insets = useSafeAreaInsets();
  const mission = useMission();
  const { apiUrl } = usePreferences();
  const online = useOnline();
  const entries = useQueue();
  const sending = useSending();
  const pending = pendingCount(entries);
  const statusOf = (id: string) => {
    const entry = entries.find((e) => e.packet.id === id);
    return entry ? displayStatus(entry, sending.has(id)) : 'queued';
  };
  const summary = format(t.summary, { n: pending });

  const notice = mission.linkDown
    ? t.linkDown
    : !online
      ? t.offline
      : !apiUrl.trim()
        ? t.noApi
        : null;

  return (
    <ScrollView
      className="bg-background flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-section p-4"
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <View className="flex-row items-baseline gap-3" accessible accessibilityLabel={summary}>
        <Text className="text-metric font-semibold tabular-nums">{pending}</Text>
        <Text className="text-muted-foreground text-body-sm flex-1">{t.queuedWord}</Text>
      </View>
      {notice ? (
        <View className="border-border min-h-touch flex-row items-center gap-3 rounded-lg border px-4 py-3">
          <View className="border-muted-foreground h-2 w-2 rounded-full border" />
          <Text className="text-body-sm flex-1">{notice}</Text>
          <Icon as={WifiOff} size={16} className="text-tertiary" />
        </View>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState icon={Inbox} title={t.nothingQueued} description={t.nothingQueuedHint} />
      ) : null}

      {GROUPS.map(({ status, title }) => {
        const group = entries.filter((e) => statusOf(e.packet.id) === status);
        if (group.length === 0) return null;
        return (
          <Section
            key={status}
            title={t[title]}
            count={group.length}
            action={
              status === 'queued' && !notice ? { label: t.retryNow, onPress: retryNow } : undefined
            }
          >
            <View className="border-border overflow-hidden rounded-lg border">
              {group.map((entry, i) => (
                <Fragment key={entry.packet.id}>
                  {i > 0 ? <View className="bg-border ml-12 h-px" /> : null}
                  <QueueRow
                    entry={entry}
                    sending={sending.has(entry.packet.id)}
                    onDiscard={discard}
                  />
                </Fragment>
              ))}
            </View>
          </Section>
        );
      })}
    </ScrollView>
  );
}
