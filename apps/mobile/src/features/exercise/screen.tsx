import {
  assessmentDue,
  dayMinutes,
  EXERCISE_KINDS,
  type ExerciseDayStatus,
  exercise,
  exerciseCompliance,
  exerciseWeek,
  firstDataAt,
  isMet,
  type Level,
  latestAssessment,
  prescriptionOf,
  targetMinutes,
} from '@haven/core';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  format,
  LEVEL_BG_CLASS,
  LEVEL_BORDER_CLASS,
  LevelBadge,
  ScreenHeader,
  Section,
} from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { useReadings } from '@/shared/data';
import { useLanguage, useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { usePlan } from '@/shared/plan';
import { AssessmentForm } from './components/assessment-form';
import { SessionForm } from './components/session-form';
import { type ExerciseTexts, texts } from './i18n';

const DAY = 86_400_000;

const DAY_LEVEL: Record<ExerciseDayStatus, Level> = {
  met: 'green',
  partial: 'amber',
  rest: 'red',
  open: 'pending',
  before: 'pending',
};

function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Progress({ label, done, target }: { label: string; done: number; target: number }) {
  const t = useTexts(texts);
  const ratio = target > 0 ? Math.min(1, done / target) : 1;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${format(t.minutesOf, { done, target })}`}
      className="gap-1.5"
    >
      <View className="flex-row items-baseline justify-between">
        <Text className="text-body font-medium">{label}</Text>
        <Text className="text-muted-foreground text-body-sm tabular-nums">
          {format(t.minutesOf, { done, target })}
        </Text>
      </View>
      <View className="bg-muted h-1.5 overflow-hidden rounded-full">
        <View
          className={cn('h-full rounded-full', ratio >= 1 ? 'bg-level-green' : 'bg-foreground')}
          style={{ width: `${ratio * 100}%` }}
        />
      </View>
    </View>
  );
}

const painLabel = (t: ExerciseTexts) => ({
  none: t.painNone.toLowerCase(),
  mild: t.painMild.toLowerCase(),
  strong: t.painStrong.toLowerCase(),
});
const completionLabel = (t: ExerciseTexts) => ({
  full: t.completionFull.toLowerCase(),
  partial: t.completionPartial.toLowerCase(),
  none: t.completionNone.toLowerCase(),
});

export default function Screen() {
  const t = useTexts(texts);
  const language = useLanguage();
  const plan = usePlan();
  const readings = useReadings();
  const now = useMinute();

  const p = prescriptionOf(plan, exercise);
  const target = targetMinutes(p);
  const since = useMemo(() => firstDataAt(readings), [readings]);
  const today = useMemo(
    () => dayMinutes(readings, now.toISOString().slice(0, 10)),
    [readings, now],
  );
  const week = useMemo(() => exerciseWeek(readings, p, now, since), [readings, p, now, since]);
  const compliance = exerciseCompliance(week, p);
  const latest = useMemo(() => latestAssessment(readings), [readings]);
  const due = assessmentDue(latest, exercise, now, since);
  const nextDate = latest
    ? new Date(Date.parse(latest.at) + exercise.assessment.everyDays * DAY).toLocaleDateString(
        language,
        { day: 'numeric', month: 'long', timeZone: 'UTC' },
      )
    : undefined;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="bg-background flex-1"
      contentContainerClassName="gap-8 p-4 pb-16"
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader title={t.title} subtitle={t.subtitle} />

      <Section title={t.today}>
        <View className="border-border gap-4 rounded-lg border p-4">
          <LevelBadge
            level={isMet(today, p) ? 'green' : 'pending'}
            label={isMet(today, p) ? t.todayMet : t.todayOpen}
          />
          {EXERCISE_KINDS.map((kind) => (
            <Progress key={kind} label={t[kind]} done={today[kind]} target={target[kind]} />
          ))}
        </View>
      </Section>

      <Section title={t.log}>
        <SessionForm />
      </Section>

      <Section title={t.week}>
        <View className="gap-3">
          <View className="flex-row justify-between gap-2">
            {week.map((d) => {
              const level = DAY_LEVEL[d.status];
              const label = new Date(`${d.day}T12:00:00Z`).toLocaleDateString(language, {
                weekday: 'narrow',
                timeZone: 'UTC',
              });
              return (
                <View
                  key={d.day}
                  accessible
                  accessibilityLabel={`${label}: ${t[d.status]}, ${d.minutes.resistance + d.minutes.aerobic} min`}
                  className="min-w-8 flex-1 items-center gap-1.5"
                >
                  <Text
                    className={cn(
                      'text-caption',
                      d.status === 'open' ? 'text-foreground font-medium' : 'text-muted-foreground',
                    )}
                  >
                    {label}
                  </Text>
                  <View
                    className={cn(
                      'h-7 w-full items-center justify-center rounded-md border',
                      LEVEL_BG_CLASS[level],
                      level === 'pending' ? 'border-border' : LEVEL_BORDER_CLASS[level],
                    )}
                  >
                    <Text className="text-caption tabular-nums">
                      {d.status === 'before' ? '–' : d.minutes.resistance + d.minutes.aerobic}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          <Text className="text-muted-foreground text-body-sm">
            {compliance.counted === 0
              ? t.weekPending
              : format(t.weekSummary, { met: compliance.met, target: compliance.target })}
          </Text>
          <View className="flex-row flex-wrap gap-x-4 gap-y-1">
            {(['met', 'partial', 'rest'] as const).map((s) => (
              <View key={s} className="flex-row items-center gap-1.5">
                <View
                  className={cn(
                    'h-2.5 w-2.5 rounded-sm border',
                    LEVEL_BG_CLASS[DAY_LEVEL[s]],
                    LEVEL_BORDER_CLASS[DAY_LEVEL[s]],
                  )}
                />
                <Text className="text-tertiary text-caption">{t[s]}</Text>
              </View>
            ))}
          </View>
        </View>
      </Section>

      <Section title={t.assessment}>
        {due ? (
          <AssessmentForm />
        ) : (
          <View className="gap-1">
            {latest ? (
              <Text className="text-body-sm">
                {format(t.lastAssessment, {
                  effort: latest.effort,
                  pain: painLabel(t)[latest.pain],
                  completion: completionLabel(t)[latest.completion],
                })}
              </Text>
            ) : null}
            <Text className="text-muted-foreground text-body-sm">
              {nextDate ? format(t.nextAssessment, { date: nextDate }) : t.noAssessment}
            </Text>
          </View>
        )}
      </Section>

      <Section title={t.prescription}>
        <View className="gap-1">
          <Text className="text-body-sm">
            {format(t.prescriptionText, {
              resistance: p.resistanceMinutes,
              aerobic: p.aerobicMinutes,
              days: p.daysPerWeek,
            })}
          </Text>
          <Text className="text-muted-foreground text-caption">
            {plan?.exercise ? t.fromEarth : t.defaultPrescription}
          </Text>
          {plan?.exercise?.note ? <Text className="text-caption">{plan.exercise.note}</Text> : null}
        </View>
      </Section>

      <Section title={t.source}>
        <Text className="text-tertiary text-caption">{exercise.source}</Text>
      </Section>
    </ScrollView>
  );
}
