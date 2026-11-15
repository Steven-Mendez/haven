import { comms, commsMode, linkTimes, type Packet } from '@haven/core';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { BigButton, format, ScreenHeader, Section } from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { Textarea } from '@/shared/components/ui/textarea';
import { usePendingSends } from '@/shared/data';
import { useLanguage, useTexts } from '@/shared/i18n';
import { MONO_FONT } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';
import { texts } from '../i18n';
import { packetSummary } from '../logic/packet';

type Props = {
  packet: Packet;
  linkDown: boolean;
  delayMin: number;
  primary: { label: string; onPress: () => void };
  onSaveNote: (note: string) => void;
};

export function PacketView({ packet, linkDown, delayMin, primary, onSaveNote }: Props) {
  const t = useTexts(texts);
  const language = useLanguage();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const summary = packetSummary(packet);
  const pending = usePendingSends();
  const status = linkDown ? t.queuedOffline : pending > 0 ? t.sending : t.sent;
  const contents = [
    `${summary.measurements} ${t.measurements.toLowerCase()}`,
    `${summary.symptoms} ${t.symptomsCount.toLowerCase()}`,
    `${summary.photos} ${t.photos.toLowerCase()}`,
    summary.ecg ? t.ecg : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
  const sent = !linkDown && pending === 0;
  const times = linkTimes(new Date(packet.sentAt), delayMin);
  const arrival =
    commsMode({ currentDelayMin: delayMin, linkDown }, comms) === 'realtime'
      ? t.arrivesSoon
      : format(t.arrivesAt, { arrives: time(times.arrivesAt), reply: time(times.replyAt) });
  const log: { label: string; detail?: string; state: 'done' | 'current' | 'next' }[] = [
    { label: t.logCreated, detail: `${time(packet.createdAt)} · ${contents}`, state: 'done' },
    {
      label: linkDown ? t.queuedOffline : sent ? t.sent : t.sending,
      detail: linkDown ? undefined : arrival,
      state: sent ? 'done' : 'current',
    },
  ];

  return (
    <View className="gap-8">
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <View
            className={cn(
              'h-2 w-2 rounded-full',
              sent ? 'bg-level-green' : linkDown ? 'border-muted-foreground border' : 'bg-brand',
            )}
          />
          <Text className="text-muted-foreground text-mono" style={{ fontFamily: MONO_FONT }}>
            {`PKT·${packet.id.slice(0, 6).toUpperCase()}`}
          </Text>
        </View>
        <ScreenHeader title={status} subtitle={t.decision} size="large" />
      </View>

      <View accessibilityLabel={t.packetLog} className="gap-0">
        {log.map((item, i) => (
          <View key={item.label} className="flex-row gap-3">
            <View className="w-4 items-center">
              <View
                className={cn(
                  'mt-1.5 h-2.5 w-2.5 rounded-full',
                  item.state === 'done'
                    ? 'bg-foreground'
                    : item.state === 'current'
                      ? 'border-brand border-2'
                      : 'border-border-strong border',
                )}
              />
              {i < log.length - 1 ? <View className="bg-border mt-1 w-px flex-1" /> : null}
            </View>
            <View className="flex-1 gap-0.5 pb-5">
              <Text className="text-body-sm font-semibold">{item.label}</Text>
              {item.detail ? (
                <Text className="text-muted-foreground text-caption tabular-nums">
                  {item.detail}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
        {packet.photos && packet.photos.length > 0 ? (
          <View className="flex-row flex-wrap gap-2 pl-7">
            {packet.photos.map((photo) => (
              <Image
                key={photo.takenAt + photo.uri.slice(-16)}
                source={{ uri: photo.uri }}
                accessibilityLabel={t.photos}
                className="bg-muted h-16 w-16 rounded-md"
              />
            ))}
          </View>
        ) : null}
      </View>

      <BigButton label={primary.label} onPress={primary.onPress} />

      {editing ? (
        <Section title={t.notes}>
          <Textarea
            value={note}
            onChangeText={setNote}
            placeholder={t.notesPlaceholder}
            accessibilityLabel={t.notes}
            className="text-body min-h-24"
            autoFocus
          />
          <BigButton
            label={t.saveNote}
            variant="secondary"
            disabled={note.trim().length === 0}
            onPress={() => {
              onSaveNote(note);
              setEditing(false);
              setSaved(true);
            }}
          />
        </Section>
      ) : null}

      <View className="gap-2">
        {saved ? <Text className="text-muted-foreground text-caption">{t.noteSaved}</Text> : null}
        {editing ? null : (
          <BigButton label={t.addNote} variant="ghost" onPress={() => setEditing(true)} />
        )}
      </View>
    </View>
  );
}
