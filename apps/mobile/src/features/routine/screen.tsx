import {
  actionsDone,
  canPerformEva,
  dailyProgress,
  dayHistory,
  dosesForDay,
  eva,
  evaPrepStatus,
  isReentry,
  medications,
  reentry,
  reentryStatus,
} from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { ScrollView, View } from 'react-native';
import {
  ActivityRings,
  BigButton,
  format,
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
import { store, useMission, usePreferences, useReadings } from '@/shared/data';
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
import { usePlan } from '@/shared/plan';
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
  cabinEnvironment,
  currentStep,
  dailyActionReading,
  lastSevenDays,
  type RoutineStep,
  routineSteps,
  stepKey,
  todayCheckin,
} from './logic/routine';

type T = (typeof texts)['es'];

function openTarget(target: ActionTarget) {
  if (target.kind === 'screen') {
    if (target.screen === 'cognition') {
      router.push({ pathname: '/cognition', params: { autostart: '1' } });
    } else router.push('/wellbeing');
  } else if (target.kind === 'indicator') {
    router.push({ pathname: '/indicator/[id]', params: { id: target.indicator, measure: '1' } });
  }
}

function StepCard({
  title,
  detail,
  action,
  onAction,
}: {
  title: string;
  detail: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View className="border-border gap-4 rounded-lg border p-4">
      <View className="gap-1">
        <Text role="heading" aria-level="2" className="text-title font-semibold">
          {title}
        </Text>
        <Text className="text-muted-foreground text-body">{detail}</Text>
      </View>
      <BigButton label={action} onPress={onAction} />
    </View>
  );
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
  const [postponed, setPostponed] = useState<string[]>([]);

  const progress = useMemo(() => dailyProgress(readings, config, now), [readings, config, now]);
  const history = useMemo(() => dayHistory(readings, config, now, 60), [readings, config, now]);
  const today = history.at(-1)?.date ?? now.toISOString().slice(0, 10);
  const steps = useMemo(
    () => routineSteps(readings, config, progress, now),
    [readings, config, progress, now],
  );
  const step = currentStep(steps, postponed);
  const environment = useMemo(
    () => cabinEnvironment(readings, config, mission.environment, now),
    [readings, config, mission.environment, now],
  );
  const checkin = useMemo(() => todayCheckin(readings, today), [readings, today]);
  const reentryPrep = useMemo(
    () => (isReentry(mission.environment) ? reentryStatus(readings, reentry, now) : undefined),
    [readings, mission.environment, now],
  );
  const evaPrep = useMemo(
    () => (canPerformEva(mission.environment, eva) ? evaPrepStatus(readings, eva, now) : undefined),
    [readings, mission.environment, now],
  );
  const plan = usePlan();
  const pendingDoses = useMemo(
    () =>
      plan
        ? dosesForDay(plan, medications, readings, now).filter(
            (d) => d.status === 'due' || d.status === 'missed',
          )
        : [],
    [plan, readings, now],
  );

  const week = lastSevenDays(history, today).map((d) => ({
    label: new Date(`${d.date}T12:00:00Z`).toLocaleDateString(language, {
      weekday: 'narrow',
      timeZone: 'UTC',
    }),
    complete: d.complete,
    today: d.today,
  }));

  const indicatorName = (id: string) =>
    translate(config.indicators.find((i) => i.id === id)?.name) || id;

  const markDone = (zone: string) =>
    store.saveReading(
      dailyActionReading(zone, {
        id: randomUUID(),
        crewMember,
        takenAt: new Date().toISOString(),
      }),
    );
  const postpone = (key: string) =>
    setPostponed((list) => (list.length + 1 >= steps.length ? [] : [...list, key]));

  const stepBody = (current: RoutineStep) => {
    switch (current.kind) {
      case 'cognition':
        return (
          <StepCard
            title={t.cognition}
            detail={t.stepCognition}
            action={t.start}
            onAction={() => openTarget({ kind: 'screen', screen: 'cognition' })}
          />
        );
      case 'wellbeing':
        return <CheckinCard crewMember={crewMember} today={checkin} />;
      case 'measure':
        return (
          <StepCard
            title={
              current.indicator === 'systolic-bp'
                ? t.bloodPressure
                : indicatorName(current.indicator)
            }
            detail={
              current.lastAt
                ? format(t.stepMeasureAgain, { n: duration(t, current.overdueMin) })
                : t.stepMeasureFirst
            }
            action={t.stepEnter}
            onAction={() => openTarget({ kind: 'indicator', indicator: current.indicator })}
          />
        );
      case 'check':
        return (
          <RestModuleCheck atmosphere={environment}>
            <BigButton label={t.stepChecked} onPress={() => void markDone(current.zone)} />
          </RestModuleCheck>
        );
    }
  };

  const doneCount = actionsDone(progress);
  const total = progress.length;
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
        subtitle={format(t.doneToday, { n: doneCount, total })}
        right={<ProfileButton />}
      />
      <MilestoneSheet milestone={milestone} onClose={closeMilestone} />

      <TourAnchor step="routine-today" fill>
        <Section title={t.now} count={steps.length > 1 ? steps.length : undefined}>
          {step ? (
            <View className="gap-3">
              {stepBody(step)}
              {steps.length > 1 ? (
                <Button
                  variant="ghost"
                  className="min-h-touch h-auto self-center sm:h-auto"
                  onPress={() => postpone(stepKey(step))}
                >
                  <Text className="text-link text-body-sm font-medium">
                    {format(t.stepLater, { n: steps.length - 1 })}
                  </Text>
                </Button>
              ) : null}
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Icon as={Check} size={16} strokeWidth={2} className="text-brand" />
              <Text className="text-muted-foreground text-body-sm flex-1">{t.dayComplete}</Text>
            </View>
          )}
        </Section>
      </TourAnchor>

      {reentryPrep ? (
        <StepCard
          title={t.reentryTitle}
          detail={
            reentryPrep.readiness === 'ready'
              ? t.reentryReady
              : format(t.reentryDetail, { done: reentryPrep.done, total: reentryPrep.total })
          }
          action={t.reentryOpen}
          onAction={() => router.push('/reentry')}
        />
      ) : null}

      {evaPrep ? (
        <StepCard
          title={t.evaTitle}
          detail={evaPrep.readiness === 'symptoms' ? t.evaSymptoms : t.evaDetail}
          action={t.evaOpen}
          onAction={() => router.push('/eva')}
        />
      ) : null}

      {pendingDoses.length ? (
        <StepCard
          title={t.medicationTitle}
          detail={format(
            pendingDoses.some((d) => d.status === 'due') ? t.medicationDue : t.medicationMissed,
            {
              names: [...new Set(pendingDoses.map((d) => d.medication))]
                .map((id) => translate(medications.catalog.find((m) => m.id === id)?.name) || id)
                .join(', '),
            },
          )}
          action={t.medicationOpen}
          onAction={() => router.push('/medication')}
        />
      ) : null}

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
            <Text className="text-title font-bold tabular-nums">{`${doneCount}/${total}`}</Text>
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

      <More label={t.more}>
        <WhereFrom text={t.whereFrom} />
      </More>
    </ScrollView>
  );
}
