import { Check, CircleAlert, Clock, Send } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { format, LevelSymbol } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { useLanguage, useTexts } from '@/shared/i18n';
import { MONO_FONT } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';
import { texts } from '../i18n';
import { summarize } from '../logic/compose';
import { displayStatus, type QueueEntry } from '../logic/queue';

type Props = { entry: QueueEntry; sending: boolean; onDiscard: (id: string) => void };

/** Status as coloured text (real states only): sending = accent, received = foreground. */
const STATUS_TONE = {
  queued: 'text-muted-foreground',
  sending: 'text-brand',
  received: 'text-foreground',
  rejected: 'text-level-red',
} as const;

const STATUS_ICON = {
  queued: Clock,
  sending: Send,
  received: Check,
  rejected: CircleAlert,
} as const;

/**
 * One line per packet: type icon · "Routine · 14:02" · real state on the right ("Queued",
 * "Sending", "Received by Earth 14:03"). Tapping shows what it carries.
 */
export function QueueRow({ entry, sending, onDiscard }: Props) {
  const t = useTexts(texts);
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const status = displayStatus(entry, sending);
  const { packet } = entry;
  const clock = (iso: string) =>
    new Date(iso).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
  const statusText = {
    queued: entry.attempts > 0 ? format(t.statusRetry, { n: entry.attempts }) : t.statusQueued,
    sending: t.statusSending,
    received: format(t.statusReceived, { t: entry.receivedAt ? clock(entry.receivedAt) : '' }),
    rejected: t.statusRejected,
  }[status];
  const title = `${packet.type === 'emergency' ? t.emergency : t.routine} · ${clock(packet.createdAt)}`;
  const summary = open ? summarize(packet) : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${statusText}`}
        className="min-h-row active:bg-active justify-center gap-2 px-4 py-2.5"
      >
        {/* Emergency packets: a 2 pt red rule on the left (Sentry / Vercel logs). */}
        {packet.type === 'emergency' ? (
          <View className="bg-level-red absolute top-0 bottom-0 left-0 w-0.5" />
        ) : null}
        <View className="flex-row items-center gap-3">
          <View className="w-5 items-center">
            {packet.type === 'emergency' ? (
              <LevelSymbol level="red" size={12} />
            ) : (
              <Icon as={Send} size={16} className="text-muted-foreground" />
            )}
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-body-sm font-medium" numberOfLines={1}>
              {packet.type === 'emergency' ? t.emergency : t.routine}
            </Text>
            <Text className="text-tertiary text-mono" style={{ fontFamily: MONO_FONT }}>
              {`${clock(packet.createdAt)} · PKT·${packet.id.slice(0, 6).toUpperCase()}`}
            </Text>
          </View>
          <Icon as={STATUS_ICON[status]} size={14} className={STATUS_TONE[status]} />
          <Text className={cn('text-caption font-medium tabular-nums', STATUS_TONE[status])}>
            {statusText}
          </Text>
        </View>
        {summary ? (
          <CollapsibleContent className="ml-8 gap-2">
            <Text className="text-muted-foreground text-caption tabular-nums">
              {format(t.contents, { r: summary.readings, a: summary.assessments })}
              {entry.duplicate ? ` · ${t.duplicate}` : ''}
            </Text>
            {entry.lastError ? (
              <Text className="text-muted-foreground text-caption">{entry.lastError}</Text>
            ) : null}
            {status === 'rejected' ? (
              <Button
                variant="outline"
                className="min-h-touch h-auto self-start rounded-full sm:h-auto"
                onPress={() => onDiscard(packet.id)}
              >
                <Text>{t.discard}</Text>
              </Button>
            ) : null}
          </CollapsibleContent>
        ) : null}
      </CollapsibleTrigger>
    </Collapsible>
  );
}
