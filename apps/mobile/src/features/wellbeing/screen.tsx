import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { Check, Lock } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  BigButton,
  DataLabel,
  EmptyState,
  format,
  ScaleInput,
  type ScaleValue,
  ScreenHeader,
  Section,
} from '@/shared/components/haven';
import { Icon } from '@/shared/components/ui/icon';
import { Label } from '@/shared/components/ui/label';
import { Text } from '@/shared/components/ui/text';
import { Textarea } from '@/shared/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { config } from '@/shared/config';
import { store, useAgeMin, useLatestReading, usePreferences, useReadings } from '@/shared/data';
import { db } from '@/shared/db';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { Footer } from './components/footer';
import { More } from './components/more';
import { WhereFrom } from './components/where-from';
import { texts } from './i18n';
import {
  buildCheckin,
  CHECKIN_COLLECTION,
  type CheckinRecord,
  CONTACT_OPTIONS,
  type Contact,
  canSave,
  JOURNAL_COLLECTION,
  JOURNAL_MAX,
  type JournalEntry,
  toggleContact,
} from './logic/checkin';

const unitOf = (id: string) => config.indicators.find((i) => i.id === id)?.unit ?? '';
const checkins = db.collection<CheckinRecord>(CHECKIN_COLLECTION);
const journalEntries = db.collection<JournalEntry>(JOURNAL_COLLECTION);

export default function Screen() {
  const t = useTexts(texts);
  const { crewMember } = usePreferences();
  const lastMood = useLatestReading('mood');
  const moodReadings = useReadings('mood');
  const stressReadings = useReadings('stress');
  const scalesDoneToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const has = (list: { takenAt: string }[]) => list.some((r) => r.takenAt.slice(0, 10) === today);
    return has(moodReadings) && has(stressReadings);
  }, [moodReadings, stressReadings]);
  const lastAge = useAgeMin(lastMood?.takenAt);
  const [mood, setMood] = useState<ScaleValue | null>(null);
  const [stress, setStress] = useState<ScaleValue | null>(null);
  const [contact, setContact] = useState<Contact[]>([]);
  const [journal, setJournal] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<{ journal: boolean } | null>(null);

  const reset = () => {
    setMood(null);
    setStress(null);
    setContact([]);
    setJournal('');
    setSaved(null);
  };

  const saveable = canSave({ mood, stress, contact, journal, scalesDoneToday });
  const save = async () => {
    if (!saveable || saving) return;
    setSaving(true);
    try {
      const c = buildCheckin({
        mood,
        stress,
        contact,
        journal,
        crewMember,
        takenAt: new Date().toISOString(),
        newId: randomUUID,
        unitOf,
      });
      if (c.readings.length > 0) await store.saveReadings(c.readings);
      await checkins.put(c.record.id, c.record);
      if (c.journal) await journalEntries.put(c.journal.id, c.journal);
      setFailed(false);
      setSaved({ journal: Boolean(c.journal) });
    } catch (error) {
      console.warn('[wellbeing] save failed', error);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="bg-background flex-1"
        contentContainerClassName="gap-8 p-4 pb-32"
      >
        <EmptyState
          title={t.saved}
          description={saved.journal ? `${t.savedDetail} ${t.savedJournal}` : t.savedDetail}
        />
        <BigButton label={t.backToRoutine} onPress={() => router.navigate('/routine')} />
        <BigButton label={t.another} variant="ghost" onPress={reset} />
      </ScrollView>
    );
  }

  return (
    <View className="bg-background flex-1">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="bg-background flex-1"
        contentContainerClassName="gap-8 p-4 pb-8"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <ScreenHeader title={t.title} subtitle={t.subtitle} />

        {scalesDoneToday ? (
          <Text className="text-body text-muted-foreground">{t.scalesDone}</Text>
        ) : (
          <>
            <ScaleInput kind="mood" title={t.mood} value={mood} onChange={setMood} />
            <ScaleInput kind="stress" title={t.stress} value={stress} onChange={setStress} />
          </>
        )}

        <Section title={t.contact}>
          <Text className="text-body-sm text-muted-foreground">{t.contactHint}</Text>
          <ToggleGroup
            type="multiple"
            value={contact}
            onValueChange={(next) => setContact((prev) => toggleContact(prev, next))}
            role="list"
            accessibilityRole="list"
            className="border-border flex-col items-stretch overflow-hidden rounded-lg border"
          >
            {CONTACT_OPTIONS.map((option, i) => {
              const selected = contact.includes(option);
              return (
                <ToggleGroupItem
                  key={option}
                  value={option}
                  accessibilityLabel={t[option]}
                  className={cn(
                    'min-h-row h-auto justify-start gap-3 px-4 sm:h-auto sm:min-w-0 sm:px-4',
                    i > 0 && 'border-border border-t',
                    selected
                      ? 'bg-brand-subtle active:bg-brand-subtle'
                      : 'active:bg-active bg-transparent',
                  )}
                >
                  <Text className="text-body-sm text-foreground flex-1 font-medium">
                    {t[option]}
                  </Text>
                  {selected ? (
                    <Icon as={Check} size={18} strokeWidth={2} className="text-brand" />
                  ) : null}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </Section>

        <Section title={t.journal}>
          <Label nativeID="journal-label" className="text-body-sm">
            {t.journalLabel}
          </Label>
          <Textarea
            aria-labelledby="journal-label"
            value={journal}
            onChangeText={(v) => setJournal(v.slice(0, JOURNAL_MAX))}
            maxLength={JOURNAL_MAX}
            placeholder={t.journalPlaceholder}
            numberOfLines={5}
            className="text-body min-h-32 rounded-lg"
          />
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 flex-row items-start gap-2">
              <Icon as={Lock} size={16} className="text-muted-foreground mt-0.5" />
              <Text className="text-tertiary text-caption flex-1">{t.journalPrivacy}</Text>
            </View>
            <Text className="text-tertiary text-caption tabular-nums">
              {format(t.counter, { n: journal.length, max: JOURNAL_MAX })}
            </Text>
          </View>
        </Section>

        {failed ? <Text className="text-body">{t.saveFailed}</Text> : null}
        <More label={t.more}>
          <View className="gap-1">
            <Text className="text-muted-foreground text-sm font-medium">{t.lastCheckin}</Text>
            <DataLabel source={lastMood?.source ?? 'screen'} ageMin={lastAge} />
          </View>
          <WhereFrom text={t.whereFrom} />
        </More>
      </ScrollView>
      <Footer>
        <BigButton
          size="lg"
          label={t.save}
          disabled={!saveable}
          loading={saving}
          onPress={() => void save()}
        />
      </Footer>
    </View>
  );
}
