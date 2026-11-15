import {
  dayHoursLevel,
  type Level,
  type WorkloadReason,
  type WorkloadStatus,
  workDays,
  workload,
  workloadStatus,
} from '@haven/core';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { format, LevelBadge, ScreenHeader, Section } from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { useReadings } from '@/shared/data';
import { useLanguage, useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { LogForm } from './components/log-form';
import { texts, type WorkloadTexts } from './i18n';

const BAR: Record<Level, string> = {
  green: 'bg-foreground',
  amber: 'bg-level-amber',
  red: 'bg-level-red',
  pending: 'bg-muted',
};
const MAX_BAR_HOURS = 14;

const STATUS: Record<Level, keyof WorkloadTexts> = {
  green: 'statusGreen',
  amber: 'statusAmber',
  red: 'statusRed',
  pending: 'statusPending',
};

function reasonText(reason: WorkloadReason, s: WorkloadStatus, t: WorkloadTexts) {
  switch (reason) {
    case 'week-hours':
      return format(t.reasonWeekHours, { hours: s.weekHours });
    case 'long-streak':
      return format(t.reasonLongStreak, { n: s.longStreak, long: workload.day.long });
    case 'over-max':
      return format(t.reasonOverMax, { max: workload.day.max });
    case 'no-rest':
      return t.reasonNoRest;
    case 'fatigue':
      return format(t.reasonFatigue, { score: s.latestFatigue ?? '' });
    default:
      return t.reasonFatigueShortSleep;
  }
}

function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Screen() {
  const t = useTexts(texts);
  const language = useLanguage();
  const readings = useReadings();
  const now = useMinute();
  const days = useMemo(() => workDays(readings, now), [readings, now]);
  const status = workloadStatus(days, workload);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="bg-background flex-1"
      contentContainerClassName="gap-8 p-4 pb-16"
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader title={t.title} subtitle={t.subtitle} />

      <View className="border-border gap-2 rounded-lg border p-4">
        <LevelBadge level={status.level} label={t[STATUS[status.level]]} />
        {status.loggedDays > 0 ? (
          <Text className="text-body font-medium tabular-nums">
            {format(t.weekSummary, { hours: status.weekHours, rest: status.restDays })}
          </Text>
        ) : null}
        {status.reasons.map((r) => (
          <Text key={r} className="text-body-sm">
            {reasonText(r, status, t)}
          </Text>
        ))}
        {status.level !== 'pending' ? (
          <Text className="text-muted-foreground text-body-sm">
            {status.level === 'red'
              ? t.adviceRed
              : status.level === 'amber'
                ? t.adviceAmber
                : t.adviceGreen}
          </Text>
        ) : null}
      </View>

      <Section title={t.today}>
        <LogForm />
      </Section>

      <Section title={t.week}>
        <View className="h-36 flex-row items-end justify-between gap-2">
          {days.map((d, i) => {
            const label = new Date(`${d.day}T12:00:00Z`).toLocaleDateString(language, {
              weekday: 'narrow',
              timeZone: 'UTC',
            });
            const level: Level = d.hours === null ? 'pending' : dayHoursLevel(d.hours, workload);
            const ratio = d.hours === null ? 0 : Math.min(1, d.hours / MAX_BAR_HOURS);
            const a11y =
              d.hours === null
                ? format(t.dayNone, { day: label })
                : `${format(t.dayHours, { day: label, hours: d.hours })}${
                    d.fatigue !== null ? `, ${format(t.dayFatigue, { score: d.fatigue })}` : ''
                  }`;
            return (
              <View
                key={d.day}
                accessible
                accessibilityLabel={a11y}
                className="h-full flex-1 items-center justify-end gap-1"
              >
                <Text className="text-caption text-muted-foreground tabular-nums">
                  {d.hours ?? '–'}
                </Text>
                <View
                  className={cn('w-full rounded-sm', BAR[level])}
                  style={{ height: `${Math.max(4, ratio * 70)}%` }}
                />
                <Text
                  className={cn(
                    'text-caption',
                    i === days.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground',
                  )}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </Section>

      <Text className="text-muted-foreground text-body-sm">{t.journal}</Text>

      <Section title={t.source}>
        <Text className="text-tertiary text-caption">{workload.source}</Text>
      </Section>
    </ScrollView>
  );
}
