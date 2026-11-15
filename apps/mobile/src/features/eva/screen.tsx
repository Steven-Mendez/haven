import {
  canPerformEva,
  eva,
  evaPrepStatus,
  postEvaReadings,
  prebreatheMethods,
  prebreatheReading,
  symptomById,
} from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ageText,
  BigButton,
  EmptyState,
  format,
  havenTexts,
  InlineConfirm,
  LevelBadge,
  ScreenHeader,
  Section,
  StepTimer,
} from '@/shared/components/haven';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { store, useMission, usePreferences, useReadings } from '@/shared/data';
import { db } from '@/shared/db';
import { useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { texts } from './i18n';
import {
  CURRENT_SESSION,
  type PrebreatheSession,
  SESSION_COLLECTION,
  sessionProgress,
} from './logic/session';

const sessions = db.collection<PrebreatheSession>(SESSION_COLLECTION);

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function SelectList({
  items,
  value,
  onChange,
  multiple,
}: {
  items: { id: string; title: string; detail?: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  multiple: boolean;
}) {
  const rows = items.map((item, i) => {
    const selected = value.includes(item.id);
    return (
      <ToggleGroupItem
        key={item.id}
        value={item.id}
        accessibilityLabel={item.title}
        className={cn(
          'min-h-row h-auto justify-start gap-3 px-4 py-3 sm:h-auto sm:min-w-0 sm:px-4',
          i > 0 && 'border-border border-t',
          selected ? 'bg-brand-subtle active:bg-brand-subtle' : 'active:bg-active bg-transparent',
        )}
      >
        <View className="flex-1 gap-0.5">
          <Text className="text-body-sm text-foreground font-medium">{item.title}</Text>
          {item.detail ? (
            <Text className="text-muted-foreground text-caption">{item.detail}</Text>
          ) : null}
        </View>
        {selected ? <Icon as={Check} size={18} strokeWidth={2} className="text-brand" /> : null}
      </ToggleGroupItem>
    );
  });
  const className = 'border-border flex-col items-stretch overflow-hidden rounded-lg border';
  return multiple ? (
    <ToggleGroup type="multiple" value={value} onValueChange={onChange} className={className}>
      {rows}
    </ToggleGroup>
  ) : (
    <ToggleGroup
      type="single"
      value={value[0]}
      onValueChange={(next) => onChange(next ? [next] : [])}
      className={className}
    >
      {rows}
    </ToggleGroup>
  );
}

export default function Screen() {
  const t = useTexts(texts);
  const h = useTexts(havenTexts);
  const translate = useTranslate();
  const mission = useMission();
  const readings = useReadings();
  const { crewMember } = usePreferences();
  const now = useNow(1000);
  const methods = useMemo(() => prebreatheMethods(mission.environment, eva), [mission.environment]);
  const [methodId, setMethodId] = useState<string | undefined>(undefined);
  const [session, setSession] = useState<PrebreatheSession | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void sessions.get(CURRENT_SESSION).then((s) => setSession(s ?? null));
  }, []);

  const minute = Math.floor(now.getTime() / 60_000);
  const status = useMemo(
    () => evaPrepStatus(readings, eva, new Date((minute + 1) * 60_000)),
    [readings, minute],
  );

  const selected = methods.find((m) => m.id === (methodId ?? methods[0]?.id));
  const active = session ? eva.methods.find((m) => m.id === session.method) : undefined;
  const progress = session && active ? sessionProgress(session, active, now) : undefined;

  const start = useCallback(async () => {
    if (!selected) return;
    const next = { method: selected.id, startedAt: new Date().toISOString(), crewMember };
    await sessions.put(CURRENT_SESSION, next);
    setSession(next);
  }, [selected, crewMember]);

  const finish = useCallback(async () => {
    if (!session || !active) return;
    setSaving(true);
    try {
      await store.saveReading(
        prebreatheReading(
          { method: active, startedAt: session.startedAt },
          { crewMember, takenAt: new Date().toISOString(), newId: randomUUID },
        ),
      );
      await sessions.remove(CURRENT_SESSION);
      setSession(null);
      setConfirmStop(false);
      setFailed(false);
    } catch (error) {
      console.warn('[eva] save failed', error);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }, [session, active, crewMember]);

  const saveCheck = async () => {
    setSaving(true);
    try {
      await store.saveReadings(
        postEvaReadings(symptoms, {
          crewMember,
          takenAt: new Date().toISOString(),
          newId: randomUUID,
        }),
      );
      setFailed(false);
      if (symptoms.length) {
        router.push({
          pathname: '/emergency',
          params: { protocol: eva.postEva.protocol, origin: 'assessment' },
        });
      }
      setSymptoms([]);
    } catch (error) {
      console.warn('[eva] check failed', error);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  if (!canPerformEva(mission.environment, eva) && !session) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="bg-background flex-1"
        contentContainerClassName="gap-8 p-4"
      >
        <EmptyState title={t.unavailable} description={t.unavailableDetail} />
      </ScrollView>
    );
  }

  const pre = status.prebreathe;
  const statusDetail =
    status.readiness === 'incomplete'
      ? t.incompleteDetail
      : status.readiness === 'symptoms'
        ? t.symptomsDetail
        : undefined;
  const showCheck = !session && pre && status.readiness !== 'symptoms' && !status.check;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="bg-background flex-1"
      contentContainerClassName="gap-8 p-4 pb-16"
    >
      <ScreenHeader title={t.title} subtitle={t.subtitle} />

      <Section title={t.status}>
        <View className="border-border gap-2 rounded-lg border p-4">
          <LevelBadge level={status.level} size="lg" label={t[status.readiness]} />
          {statusDetail ? <Text className="text-body">{statusDetail}</Text> : null}
          {pre ? (
            <Text className="text-muted-foreground text-body-sm tabular-nums">
              {format(t.lastPrebreathe, {
                minutes: pre.minutes,
                required: pre.required,
                age: ageText(h, (now.getTime() - Date.parse(pre.takenAt)) / 60_000),
              })}
            </Text>
          ) : null}
          {status.check ? (
            <Text className="text-muted-foreground text-body-sm">
              {format(t.checked, {
                age: ageText(h, (now.getTime() - Date.parse(status.check.takenAt)) / 60_000),
              })}
            </Text>
          ) : null}
        </View>
      </Section>

      {session && active && progress ? (
        <Section title={translate(active.name)}>
          <View className="items-center gap-4">
            <StepTimer
              total={progress.totalSec}
              remaining={progress.remainingSec}
              label={t.breathing}
            />
            <Text className="text-muted-foreground text-body-sm tabular-nums">
              {format(t.elapsed, { n: Math.floor(progress.elapsedSec / 60) })}
            </Text>
            <Text className="text-muted-foreground text-body text-center">{t.breathingDetail}</Text>
          </View>
          {progress.complete ? (
            <BigButton label={t.finish} loading={saving} onPress={() => void finish()} />
          ) : confirmStop ? (
            <InlineConfirm
              title={t.stopEarlyConfirm}
              confirmLabel={t.stopEarlyYes}
              confirmVariant="destructive"
              onConfirm={() => void finish()}
              onCancel={() => setConfirmStop(false)}
            />
          ) : (
            <BigButton
              variant="secondary"
              label={t.stopEarly}
              onPress={() => setConfirmStop(true)}
            />
          )}
        </Section>
      ) : (
        <Section title={t.method}>
          <SelectList
            multiple={false}
            value={selected ? [selected.id] : []}
            onChange={(next) => setMethodId(next[0])}
            items={methods.map((m) => ({
              id: m.id,
              title: `${translate(m.name)} · ${format(t.minutes, { n: m.minutes })}`,
              detail: translate(m.detail),
            }))}
          />
          <BigButton label={t.start} disabled={!selected} onPress={() => void start()} />
        </Section>
      )}

      {showCheck ? (
        <Section title={t.checkTitle}>
          <Text className="text-muted-foreground text-body-sm">{t.checkBody}</Text>
          <SelectList
            multiple
            value={symptoms}
            onChange={setSymptoms}
            items={eva.postEva.symptoms.map((id) => ({
              id,
              title: translate(symptomById(id)?.name) || id,
            }))}
          />
          <BigButton
            label={symptoms.length ? t.saveCheck : t.noSymptoms}
            variant={symptoms.length ? 'emergency' : 'primary'}
            loading={saving}
            onPress={() => void saveCheck()}
          />
        </Section>
      ) : null}

      {failed ? <Text className="text-body">{t.saveFailed}</Text> : null}

      <Section title={t.source}>
        <Text className="text-tertiary text-caption">{eva.source}</Text>
      </Section>
    </ScrollView>
  );
}
