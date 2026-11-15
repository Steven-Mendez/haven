import {
  actionsDone,
  adaptationWindow,
  balanceAvailable,
  canPerformEva,
  dailyProgress,
  dayHistory,
  dosesForDay,
  eva,
  evaPrepStatus,
  exercise,
  exerciseReminder,
  isReentry,
  medications,
  motion,
  motionCheckDue,
  prescriptionOf,
  reentry,
  reentryStatus,
  sampleConfig,
  sampleStates,
  workDays,
  workload,
  workloadReminder,
} from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Brain,
  BriefcaseBusiness,
  Check,
  Dumbbell,
  Footprints,
  Pill,
  PlaneLanding,
  SmilePlus,
  TestTube,
  Waves,
} from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { ScrollView, View } from 'react-native';
import {
  BigButton,
  format,
  type RingDatum,
  ScreenHeader,
  Section,
} from '@/shared/components/haven';
import { ProfileButton } from '@/shared/components/profile-button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
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
import { usePlan } from '@/shared/plan';
import { TourAnchor, useTourScroll } from '@/shared/tour';
import { CheckinCard } from './components/checkin-card';
import { ProgressTile, StreakTile, Tile, TileGroup } from './components/dashboard';
import { ActionsGuide } from './components/guide';
import { LaterButton } from './components/later-button';
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
  later,
}: {
  title: string;
  detail: string;
  action: string;
  onAction: () => void;
  /** "Not now" button, inside the card under the main action. */
  later?: ReactNode;
}) {
  return (
    <View className="border-border gap-4 rounded-lg border p-4">
      <View className="gap-1">
        <Text role="heading" aria-level="2" className="text-title font-semibold">
          {title}
        </Text>
        <Text className="text-muted-foreground text-body">{detail}</Text>
      </View>
      <View className="gap-3">
        <BigButton label={action} onPress={onAction} />
        {later}
      </View>
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
  const pendingSamples = useMemo(
    () =>
      sampleStates(sampleConfig, Math.max(1, mission.day), readings, now).filter(
        (s) => s.status === 'due' || s.status === 'overdue',
      ),
    [mission.day, readings, now],
  );
  const exerciseDue = useMemo(
    () => exerciseReminder(readings, prescriptionOf(plan, exercise), exercise, now),
    [plan, readings, now],
  );
  const motionDue = useMemo(
    () => motionCheckDue(readings, adaptationWindow(mission, motion, config.environments), now),
    [readings, mission, config.environments, now],
  );
  const workloadDue = useMemo(() => workloadReminder(readings, workload, now), [readings, now]);
  const workloadLogged = useMemo(
    () => workDays(readings, now, 1).at(-1)?.hours !== null,
    [readings, now],
  );
  const motionWindow = useMemo(
    () => adaptationWindow(mission, motion, config.environments),
    [mission, config.environments],
  );
  // The tile is always there: head movements help whenever someone feels sick.
  const motionActive =
    motionWindow.open || balanceAvailable(mission.environment, config.environments);
  const cognitionDue = steps.some((s) => s.kind === 'cognition');
  const wellbeingDone =
    g.today.wellbeing.total > 0 && g.today.wellbeing.done >= g.today.wellbeing.total;
  const doseNames = [...new Set(pendingDoses.map((d) => d.medication))]
    .map((id) => translate(medications.catalog.find((m) => m.id === id)?.name) || id)
    .join(', ');
  const sampleNames = pendingSamples
    .map((s) => translate(sampleConfig.samples.find((x) => x.id === s.sample)?.name))
    .join(', ');

  const week = lastSevenDays(history, today).map((d) => ({
    date: d.date,
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
    const later =
      steps.length > 1 ? (
        <LaterButton
          label={format(t.stepLater, { n: steps.length - 1 })}
          onPress={() => postpone(stepKey(current))}
        />
      ) : null;
    switch (current.kind) {
      case 'cognition':
        return (
          <StepCard
            title={t.cognition}
            detail={t.stepCognition}
            action={t.start}
            onAction={() => openTarget({ kind: 'screen', screen: 'cognition' })}
            later={later}
          />
        );
      case 'wellbeing':
        return <CheckinCard crewMember={crewMember} today={checkin} later={later} />;
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
            later={later}
          />
        );
      case 'check':
        return (
          <RestModuleCheck atmosphere={environment}>
            <BigButton label={t.stepChecked} onPress={() => void markDone(current.zone)} />
            {later}
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
            stepBody(step)
          ) : (
            <View className="flex-row items-center gap-2">
              <Icon as={Check} size={16} strokeWidth={2} className="text-brand" />
              <Text className="text-muted-foreground text-body-sm flex-1">{t.dayComplete}</Text>
            </View>
          )}
        </Section>
      </TourAnchor>

      <View className="flex-row gap-3">
        <ProgressTile
          title={t.progressTitle}
          rings={rings}
          done={doneCount}
          total={total}
          hint={t.progressHint}
          accessibilityLabel={format(t.ringsLabel, {
            a: `${g.today.routine.done}/${g.today.routine.total}`,
            b: `${g.today.measurements.done}/${g.today.measurements.total}`,
            c: `${g.today.wellbeing.done}/${g.today.wellbeing.total}`,
          })}
          onPress={() => setGuideOpen((open) => !open)}
        />
        <StreakTile
          title={t.streakTitle}
          streak={g.streak}
          unit={g.streak === 1 ? t.streakDay : t.streakDays}
          best={format(t.bestStreak, { n: Math.max(g.best, g.streak) })}
          week={week}
          hint={t.openStreak}
          onPress={() => router.push('/streak')}
        />
      </View>
      {guideOpen ? <ActionsGuide /> : null}

      <TileGroup title={t.groupDaily}>
        <Tile
          icon={SmilePlus}
          title={t.tileWellbeing}
          state={wellbeingDone ? 'green' : 'pending'}
          status={wellbeingDone ? t.stDoneToday : t.stWellbeingDue}
          onPress={() => router.push('/wellbeing')}
        />
        <Tile
          icon={Brain}
          title={t.tileCognition}
          state={cognitionDue ? 'pending' : 'green'}
          status={cognitionDue ? t.stCognitionDue : t.stDoneToday}
          onPress={() => openTarget({ kind: 'screen', screen: 'cognition' })}
        />
        <Tile
          icon={BriefcaseBusiness}
          title={t.tileWorkload}
          state={
            workloadDue === 'rest'
              ? 'red'
              : workloadDue === 'log'
                ? 'amber'
                : workloadLogged
                  ? 'green'
                  : 'pending'
          }
          status={
            workloadDue === 'rest'
              ? t.stWorkloadRest
              : workloadDue === 'log'
                ? t.stWorkloadLog
                : workloadLogged
                  ? t.stDoneToday
                  : t.stWorkloadLater
          }
          onPress={() => router.push('/workload')}
        />
      </TileGroup>

      <TileGroup title={t.groupCare}>
        <Tile
          icon={Pill}
          title={t.tileMedication}
          state={
            pendingDoses.some((d) => d.status === 'missed')
              ? 'red'
              : pendingDoses.length
                ? 'amber'
                : plan?.medications.length
                  ? 'green'
                  : 'pending'
          }
          status={
            pendingDoses.length
              ? format(pendingDoses.some((d) => d.status === 'due') ? t.stDue : t.stMissed, {
                  names: doseNames,
                })
              : plan?.medications.length
                ? t.stUpToDate
                : t.stNoPlan
          }
          onPress={() => router.push('/medication')}
        />
        <Tile
          icon={Dumbbell}
          title={t.tileExercise}
          state={exerciseDue ? 'amber' : 'green'}
          status={
            !exerciseDue
              ? t.stDoneToday
              : exerciseDue.kind === 'assessment'
                ? t.stExerciseAssessment
                : format(t.stExerciseMinutes, {
                    done: exerciseDue.done,
                    target: exerciseDue.target,
                  })
          }
          onPress={() => router.push('/exercise')}
        />
        <Tile
          icon={TestTube}
          title={t.tileSamples}
          state={
            pendingSamples.some((s) => s.status === 'overdue')
              ? 'red'
              : pendingSamples.length
                ? 'amber'
                : 'green'
          }
          status={
            pendingSamples.length
              ? format(pendingSamples.some((s) => s.status === 'overdue') ? t.stOverdue : t.stDue, {
                  names: sampleNames,
                })
              : t.stUpToDate
          }
          onPress={() => router.push('/samples')}
        />
      </TileGroup>

      <TileGroup title={t.groupMission}>
        {reentryPrep ? (
          <Tile
            icon={PlaneLanding}
            title={t.tileReentry}
            state={reentryPrep.readiness === 'ready' ? 'green' : 'amber'}
            status={
              reentryPrep.readiness === 'ready'
                ? t.stReentryReady
                : format(t.stReentryProgress, {
                    done: reentryPrep.done,
                    total: reentryPrep.total,
                  })
            }
            onPress={() => router.push('/reentry')}
          />
        ) : null}
        {evaPrep ? (
          <Tile
            icon={Footprints}
            title={t.tileEva}
            state={
              evaPrep.readiness === 'symptoms' ? 'red' : evaPrep.prebreathe ? 'green' : 'pending'
            }
            status={
              evaPrep.readiness === 'symptoms'
                ? t.stEvaSymptoms
                : evaPrep.prebreathe
                  ? t.stEvaDone
                  : t.stEvaNone
            }
            onPress={() => router.push('/eva')}
          />
        ) : null}
        <Tile
          icon={Waves}
          title={t.tileMotion}
          state={motionDue ? 'amber' : motionActive ? 'green' : 'pending'}
          status={
            motionDue
              ? t.stMotionDue
              : motionWindow.open
                ? format(t.stMotionWindow, { day: motionWindow.day, of: motionWindow.of })
                : motionActive
                  ? t.stMotionBalance
                  : t.stMotionAnytime
          }
          onPress={() => router.push('/motion')}
        />
      </TileGroup>

      <More label={t.more}>
        <WhereFrom text={t.whereFrom} />
      </More>
    </ScrollView>
  );
}
