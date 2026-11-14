import { type Action, actionsDone, dailyProgress, dayHistory } from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { ScrollView, View } from 'react-native';
import {
  ActionRow,
  ActivityRings,
  format,
  ListGroup,
  type RingDatum,
  RingLegend,
  RingSpark,
  ScreenHeader,
  Section,
} from '@/shared/components/haven';
import { ProfileButton } from '@/shared/components/profile-button';
import { Button } from '@/shared/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible';
import { Icon } from '@/shared/components/ui/icon';
import { Text, TextClassContext } from '@/shared/components/ui/text';
import { useConfig } from '@/shared/config';
import {
  store,
  useAssessments,
  useMission,
  usePreferences,
  useReadings,
  useZones,
} from '@/shared/data';
import { db } from '@/shared/db';
import {
  markMilestoneSeen,
  onMilestonePreview,
  pendingMilestone,
  seenMilestones,
  useGamification,
} from '@/shared/gamification';
import { useLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { useLayout } from '@/shared/lib/layout';
import { cn } from '@/shared/lib/utils';
import { TourAnchor, useTourScroll } from '@/shared/tour';
import { CheckinCard } from './components/checkin-card';
import { ActionsGuide } from './components/guide';
import { MilestoneSheet } from './components/milestone-sheet';
import { More } from './components/more';
import { RestModuleCheck } from './components/rest-module-check';
import { WhereFrom } from './components/where-from';
import { useNow } from './hooks/use-now';
import { texts } from './i18n';
import {
  type ActionTarget,
  canMarkDone,
  type DailyItem,
  dailyActionReading,
  dailyItems,
  dueMeasurements,
  lastSevenDays,
  nextActions,
  restModuleAtmosphere,
  SKIP_COLLECTION,
  type SkipRecord,
  skipId,
  todayCheckin,
} from './logic/routine';

type T = (typeof texts)['es'];
const skips = db.collection<SkipRecord>(SKIP_COLLECTION);

function openTarget(target: ActionTarget) {
  if (target.kind === 'screen') {
    if (target.screen === 'cognition') {
      router.push({ pathname: '/cognition', params: { autostart: '1' } });
    } else router.push('/wellbeing');
  } else if (target.kind === 'indicator') {
    router.push({ pathname: '/indicator/[id]', params: { id: target.indicator } });
  }
}

function duration(t: T, minutes: number): string {
  if (minutes < 60) return format(t.minutesShort, { n: Math.max(1, minutes) });
  if (minutes < 48 * 60) return format(t.hours, { n: Math.round(minutes / 60) });
  return format(t.days, { n: Math.round(minutes / 1440) });
}

export default function Screen() {
  const t = useTexts(texts);
  const { scale } = useLayout();
  const translate = useTranslate();
  const language = useLanguage();
  const config = useConfig();
  const readings = useReadings();
  const assessments = useAssessments();
  const zones = useZones();
  const mission = useMission();
  const { crewMember } = usePreferences();
  const now = useNow([readings]);
  const [guideOpen, setGuideOpen] = useState(false);
  const g = useGamification();
  const scroll = useRef<ScrollViewInstance>(null);
  const onTourScroll = useTourScroll('routine', scroll);
  const { milestone: preview } = useLocalSearchParams<{ milestone?: string }>();
  const [milestone, setMilestone] = useState<{
    kind: 'streak' | 'mission';
    value: number;
    key: string;
  } | null>(null);
  useEffect(() => {
    if (preview && Number(preview) > 0) {
      setMilestone({ kind: 'streak', value: Number(preview), key: `preview-${preview}` });
      return;
    }
    const next = pendingMilestone(g.streak, mission.day, seenMilestones());
    if (next) setMilestone(next);
  }, [g.streak, mission.day, preview]);
  useEffect(
    () =>
      onMilestonePreview((value) =>
        setMilestone({ kind: 'streak', value, key: `preview-${value}` }),
      ),
    [],
  );
  const closeMilestone = () => {
    if (milestone && !milestone.key.startsWith('preview')) markMilestoneSeen(milestone.key);
    setMilestone(null);
  };
  const [restOpen, setRestOpen] = useState(false);
  const [skipped, setSkipped] = useState<SkipRecord[]>([]);

  useEffect(() => {
    void skips
      .all()
      .then(setSkipped)
      .catch((e) => console.warn('[routine] skips not loaded', e));
  }, []);

  const progress = useMemo(() => dailyProgress(readings, config, now), [readings, config, now]);
  const history = useMemo(() => dayHistory(readings, config, now, 60), [readings, config, now]);
  const today = history.at(-1)?.date ?? now.toISOString().slice(0, 10);
  const items = useMemo(() => dailyItems(config, progress, zones), [config, progress, zones]);
  const due = useMemo(() => dueMeasurements(readings, config, now), [readings, config, now]);
  const atmosphere = useMemo(
    () => restModuleAtmosphere(readings, config, mission.environment, now),
    [readings, config, mission.environment, now],
  );
  const checkin = useMemo(() => todayCheckin(readings, today), [readings, today]);

  const skippedToday = skipped
    .filter((s) => s.date === today && s.crewMember === crewMember)
    .map((s) => s.zone);

  const week = lastSevenDays(history, today).map((d) => ({
    label: new Date(`${d.date}T12:00:00Z`).toLocaleDateString(language, {
      weekday: 'narrow',
      timeZone: 'UTC',
    }),
    complete: d.complete,
    today: d.today,
  }));

  const engineActions = useMemo(() => {
    const seen = new Set<string>();
    const out: { action: Action; indicator: string }[] = [];
    const worstFirst = [...assessments].sort(
      (a, b) => Number(b.level === 'red') - Number(a.level === 'red'),
    );
    for (const a of worstFirst) {
      if (a.level !== 'amber' && a.level !== 'red') continue;
      for (const action of a.actions) {
        if (seen.has(action.id) || out.length >= 3) continue;
        seen.add(action.id);
        out.push({ action, indicator: a.indicator });
      }
    }
    return out;
  }, [assessments]);

  const zoneById = (id: string) => config.zones.find((z) => z.id === id);
  const indicatorName = (id: string) =>
    translate(config.indicators.find((i) => i.id === id)?.name) || id;

  const markDone = async (zone: string) => {
    if (skippedToday.includes(zone)) await undoSkip(zone);
    await store.saveReading(
      dailyActionReading(zone, {
        id: randomUUID(),
        crewMember,
        takenAt: new Date().toISOString(),
      }),
    );
  };
  const skip = async (zone: string) => {
    const record = { id: skipId(today, zone, crewMember), date: today, zone, crewMember };
    setSkipped((list) => [...list.filter((s) => s.id !== record.id), record]);
    await skips.put(record.id, record).catch((e) => console.warn('[routine] skip not saved', e));
  };
  const undoSkip = async (zone: string) => {
    const id = skipId(today, zone, crewMember);
    setSkipped((list) => list.filter((s) => s.id !== id));
    await skips.remove(id).catch((e) => console.warn('[routine] skip not removed', e));
  };

  const titleOf = (item: DailyItem) => {
    const target = item.target;
    if (item.zone === 'mind') return t.wellbeing;
    if (target.kind === 'indicator') return indicatorName(target.indicator);
    if (target.kind === 'screen') {
      return target.screen === 'cognition' ? format(t.battery, { n: item.minutes }) : t.wellbeing;
    }
    return t.restModule;
  };

  const open = nextActions(items, 7, ['mind']);
  const done = items.filter((i) => i.progress >= 1);

  const row = (item: DailyItem) => {
    const zone = zoneById(item.zone);
    if (!zone) return null;
    const target = item.target;
    const title = titleOf(item);
    const state = skippedToday.includes(item.zone) ? ('skipped' as const) : ('open' as const);
    if (target.kind === 'mark') {
      return (
        <View key={item.zone}>
          <ActionRow
            grouped
            title={title}
            zone={item.zone}
            progress={item.progress}
            startLabel={t.start}
            onStart={() => setRestOpen((v) => !v)}
          />
          {restOpen ? (
            <View className="px-4 pb-3">
              <RestModuleCheck atmosphere={atmosphere}>
                <ActionRow
                  title={t.restModuleCheck}
                  state={state}
                  onDone={() => void markDone(item.zone)}
                  onSkip={() => void skip(item.zone)}
                  onUndo={() => void undoSkip(item.zone)}
                />
              </RestModuleCheck>
            </View>
          ) : null}
        </View>
      );
    }
    if (canMarkDone(zone, config)) {
      return (
        <ActionRow
          key={item.zone}
          grouped
          title={title}
          zone={item.zone}
          state={state}
          onDone={() => void markDone(item.zone)}
          onSkip={() => void skip(item.zone)}
          onUndo={() => void undoSkip(item.zone)}
        />
      );
    }
    return (
      <ActionRow
        key={item.zone}
        grouped
        title={title}
        zone={item.zone}
        progress={item.progress}
        startLabel={target.kind === 'indicator' ? t.measure : t.start}
        onStart={() => openTarget(target)}
      />
    );
  };

  const doneCount = actionsDone(progress);
  const rings: RingDatum[] = [
    { id: 'routine', ...g.today.routine, label: t.ringRoutine },
    { id: 'measurements', ...g.today.measurements, label: t.ringMeasurements },
    { id: 'wellbeing', ...g.today.wellbeing, label: t.ringWellbeing },
  ];
  return (
    <ScrollView
      ref={scroll}
      onScroll={onTourScroll}
      scrollEventThrottle={32}
      className="bg-background flex-1"
      contentContainerClassName="gap-8 px-4 pt-3 pb-8"
    >
      <ScreenHeader
        title={t.title}
        subtitle={format(t.doneToday, { n: doneCount })}
        right={<ProfileButton />}
      />
      <MilestoneSheet milestone={milestone} onClose={closeMilestone} />

      <Collapsible open={guideOpen} onOpenChange={setGuideOpen} className="gap-8">
        <CollapsibleTrigger
          accessibilityHint={t.howToRead}
          className="flex-row items-center gap-5 active:opacity-80"
        >
          <ActivityRings
            rings={rings}
            size={Math.round(168 * scale)}
            accessibilityLabel={format(t.ringsLabel, {
              a: `${g.today.routine.done}/${g.today.routine.total}`,
              b: `${g.today.measurements.done}/${g.today.measurements.total}`,
              c: `${g.today.wellbeing.done}/${g.today.wellbeing.total}`,
            })}
          >
            <Text className="text-title font-bold tabular-nums">{`${doneCount}/7`}</Text>
          </ActivityRings>
          <RingLegend rings={rings} className="flex-1" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ActionsGuide />
        </CollapsibleContent>
      </Collapsible>

      <Button
        variant="ghost"
        accessibilityRole="button"
        accessibilityHint={t.openStreak}
        onPress={() => router.push('/streak')}
        className="border-border active:bg-active h-auto flex-col items-stretch justify-start gap-4 rounded-lg border p-4 sm:h-auto"
      >
        <TextClassContext.Provider value={undefined}>
          <View className="flex-row items-end justify-between gap-3">
            <View className="flex-row items-baseline gap-2">
              <RingSpark size={20} />
              <Text className="text-metric font-bold tabular-nums">{g.streak}</Text>
              <Text className="text-muted-foreground text-body-sm">
                {g.streak === 1 ? t.streakDay : t.streakDays}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-tertiary text-caption tabular-nums">
                {format(t.bestStreak, { n: Math.max(g.best, g.streak) })}
              </Text>
              <Icon as={ChevronRight} size={16} className="text-tertiary -mr-1" />
            </View>
          </View>
          <View className="flex-row justify-between">
            {g.week.map((day, i) => {
              const isToday = i === g.week.length - 1;
              return (
                <View key={day.date} className="items-center gap-1.5">
                  <ActivityRings
                    size={30}
                    animate={false}
                    rings={[
                      { id: 'routine', ...day.routine },
                      { id: 'measurements', ...day.measurements },
                      { id: 'wellbeing', ...day.wellbeing },
                    ]}
                    accessibilityLabel={`${week[i]?.label ?? ''}: ${day.routine.done}/${day.routine.total}`}
                  />
                  <Text
                    className={cn(
                      'text-[11px] leading-[14px]',
                      isToday ? 'text-foreground font-bold' : 'text-tertiary',
                    )}
                  >
                    {week[i]?.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text className="text-tertiary text-caption">{t.streakHint}</Text>
        </TextClassContext.Provider>
      </Button>

      <TourAnchor step="routine-checkin" fill>
        <CheckinCard crewMember={crewMember} today={checkin} />
      </TourAnchor>

      <TourAnchor step="routine-today" fill>
        <Section title={t.today} count={open.length > 0 ? open.length : undefined}>
          {open.length === 0 && doneCount === 7 ? (
            <View className="flex-row items-center gap-2">
              <Icon as={Check} size={16} strokeWidth={2} className="text-brand" />
              <Text className="text-muted-foreground text-body-sm flex-1">{t.dayComplete}</Text>
            </View>
          ) : null}
          {open.length + done.length > 0 ? (
            <ListGroup inset={52}>
              {[
                ...open.map(row),
                ...done.map((item) => (
                  <ActionRow
                    key={`done-${item.zone}`}
                    grouped
                    title={titleOf(item)}
                    zone={item.zone}
                    progress={1}
                  />
                )),
              ]}
            </ListGroup>
          ) : null}
        </Section>
      </TourAnchor>

      {due.length > 0 ? (
        <Section title={t.due} count={due.length}>
          <ListGroup inset={52}>
            {due.map((d) => {
              const name =
                d.key === 'cognition'
                  ? t.cognition
                  : d.key === 'wellbeing'
                    ? t.wellbeing
                    : indicatorName(d.key);
              const when = d.lastAt ? format(t.dueAgo, { n: duration(t, d.overdueMin) }) : t.dueNow;
              return (
                <ActionRow
                  key={d.key}
                  grouped
                  title={name}
                  detail={when}
                  zone={d.zone}
                  next
                  startLabel={t.measure}
                  onStart={() => openTarget(d.target)}
                />
              );
            })}
          </ListGroup>
        </Section>
      ) : null}

      {engineActions.length > 0 ? (
        <Section title={t.engine}>
          <ListGroup>
            {engineActions.map(({ action, indicator }) => (
              <ActionRow
                key={action.id}
                grouped
                title={translate(action.text)}
                detail={indicatorName(indicator)}
                startLabel={t.open}
                onStart={() =>
                  router.push({
                    pathname: '/indicator/[id]',
                    params: { id: indicator },
                  })
                }
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      <More label={t.more}>
        <WhereFrom text={t.whereFrom} />
      </More>
    </ScrollView>
  );
}
