import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ActivityRings, format, RingSpark } from '@/shared/components/haven';
import { Screen } from '@/shared/components/screen';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { dateKey, STREAK_MILESTONES, useGamification, useRingDays } from '@/shared/gamification';
import { useLanguage, useTexts } from '@/shared/i18n';
import { useLayout } from '@/shared/lib/layout';
import { cn } from '@/shared/lib/utils';
import { texts } from './i18n';
import {
  type DayStatus,
  dayStatus,
  daysOfMonth,
  monthGrid,
  monthOf,
  nextMilestone,
  shiftMonth,
} from './logic/calendar';

/** One stat cell: bold figure over a grey label (Profile status grid). */
function Stat({ value, label, first }: { value: number; label: string; first?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      className={cn('flex-1 gap-1 px-3 py-3', !first && 'border-border border-l')}
    >
      <Text className="text-title font-semibold tabular-nums">{value}</Text>
      <Text className="text-muted-foreground text-caption" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Streak calendar (Duolingo / Speak / Noom month view, in HAVEN's sober style): the streak and the
 * next goal, best / complete / protected counts, and the month as mini rings. Protected days carry a
 * shield: they never break the streak. Months go back to the first reading, never past today.
 */
export default function StreakScreen() {
  const t = useTexts(texts);
  const language = useLanguage();
  const { width } = useLayout();
  const g = useGamification();
  const today = dateKey(Date.now());
  const [month, setMonth] = useState(() => monthOf(today));
  const dates = useMemo(() => daysOfMonth(month), [month]);
  const { days, firstDay } = useRingDays(dates);
  const safe = useMemo(() => new Set(g.protectedDays), [g.protectedDays]);

  const ringsOf = new Map(days.map((d) => [d.date, d]));
  const statusOf = (date: string): DayStatus => {
    const r = ringsOf.get(date);
    const complete = !!r && r.routine.total > 0 && r.routine.done >= r.routine.total;
    return dayStatus(date, today, complete, safe, firstDay);
  };
  const statuses = dates.map(statusOf);
  const completeCount = statuses.filter((s) => s === 'complete').length;
  const protectedCount = statuses.filter((s) => s === 'protected').length;

  const weekStart = language === 'es' ? 1 : 0;
  const grid = monthGrid(month, weekStart);
  const locale = language === 'es' ? 'es-ES' : 'en-US';
  const monthTitle = new Date(`${month}-15T12:00:00Z`).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  // 2026-11-01 is a Sunday: weekday initials in the grid's order.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2026, 10, 1 + ((i + weekStart) % 7), 12)).toLocaleDateString(locale, {
      weekday: 'narrow',
      timeZone: 'UTC',
    }),
  );

  const canBack = !!firstDay && shiftMonth(month, -1) >= monthOf(firstDay);
  const canForward = month < monthOf(today);

  // Screen and card padding (16 + 16 on each side), then 7 equal columns.
  const cell = Math.floor((width - 64) / 7);
  const ring = Math.min(36, cell - 10);

  const goal = nextMilestone(g.streak, STREAK_MILESTONES);
  const statusLabel: Record<DayStatus, string> = {
    complete: t.complete,
    protected: t.protected,
    missed: t.missed,
    open: t.open,
    future: t.future,
    none: t.noData,
  };

  return (
    <Screen contentClassName="gap-6">
      {/* The streak and the next goal */}
      <View className="gap-1">
        <View className="flex-row items-baseline gap-2">
          <RingSpark size={24} />
          <Text className="text-[56px] leading-[60px] font-bold tabular-nums">{g.streak}</Text>
          <Text className="text-muted-foreground text-body">
            {g.streak === 1 ? t.dayInARow : t.daysInARow}
          </Text>
        </View>
        <Text className="text-muted-foreground text-body-sm">
          {goal
            ? format(goal.left === 1 ? t.nextGoalOne : t.nextGoal, {
                n: goal.left,
                goal: goal.value,
              })
            : t.allGoals}
        </Text>
      </View>

      <View className="border-border flex-row rounded-lg border">
        <Stat first value={Math.max(g.best, g.streak)} label={t.best} />
        <Stat value={completeCount} label={t.completeMonth} />
        <Stat value={protectedCount} label={t.protectedMonth} />
      </View>

      {/* Month calendar */}
      <View className="border-border gap-3 rounded-lg border p-4">
        <View className="flex-row items-center justify-between">
          <Text role="heading" aria-level="2" className="text-body font-semibold capitalize">
            {monthTitle}
          </Text>
          <View className="flex-row gap-1">
            <Button
              variant="ghost"
              size="icon"
              accessibilityLabel={t.previousMonth}
              disabled={!canBack}
              onPress={() => setMonth(shiftMonth(month, -1))}
            >
              <Icon as={ChevronLeft} size={20} className="text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              accessibilityLabel={t.nextMonth}
              disabled={!canForward}
              onPress={() => setMonth(shiftMonth(month, 1))}
            >
              <Icon as={ChevronRight} size={20} className="text-foreground" />
            </Button>
          </View>
        </View>

        <View className="flex-row" aria-hidden>
          {weekdays.map((d, i) => (
            <Text
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed seven columns
              key={i}
              className="text-tertiary text-caption text-center"
              style={{ width: cell }}
            >
              {d}
            </Text>
          ))}
        </View>

        <View className="gap-2">
          {grid.map((week) => (
            <View key={week.find(Boolean)} className="flex-row">
              {week.map((date, i) => {
                if (!date) {
                  // biome-ignore lint/suspicious/noArrayIndexKey: padding cells
                  return <View key={`pad-${i}`} style={{ width: cell }} />;
                }
                const status = statusOf(date);
                const r = ringsOf.get(date);
                const n = Number(date.slice(8));
                const isToday = date === today;
                const withRing =
                  r && (status === 'complete' || status === 'missed' || status === 'open');
                return (
                  <View
                    key={date}
                    accessible
                    accessibilityLabel={`${n}, ${statusLabel[status]}`}
                    className="items-center gap-1"
                    style={{ width: cell }}
                  >
                    {/* Missed days fade so the run of closed rings reads at a glance. */}
                    <View
                      className={cn(
                        'items-center justify-center',
                        status === 'missed' && 'opacity-40',
                      )}
                      style={{ width: ring, height: ring }}
                    >
                      {withRing ? (
                        <ActivityRings
                          size={ring}
                          animate={false}
                          rings={[
                            { id: 'routine', ...r.routine },
                            { id: 'measurements', ...r.measurements },
                            { id: 'wellbeing', ...r.wellbeing },
                          ]}
                        />
                      ) : status === 'protected' ? (
                        <View
                          className="bg-muted items-center justify-center rounded-full"
                          style={{ width: ring, height: ring }}
                        >
                          <Icon
                            as={ShieldCheck}
                            size={Math.round(ring * 0.5)}
                            strokeWidth={1.75}
                            className="text-muted-foreground"
                          />
                        </View>
                      ) : (
                        // Days to come or before any data: a faint outline keeps the grid's rhythm.
                        <View
                          className="border-border rounded-full border"
                          style={{ width: ring - 4, height: ring - 4 }}
                        />
                      )}
                    </View>
                    <Text
                      className={cn(
                        'text-[11px] leading-[14px] tabular-nums',
                        status === 'complete'
                          ? 'text-foreground font-semibold'
                          : status === 'future' || status === 'none'
                            ? 'text-tertiary'
                            : 'text-muted-foreground',
                        isToday && 'text-foreground font-bold',
                      )}
                    >
                      {n}
                    </Text>
                    <View
                      className={cn(
                        'h-1 w-1 rounded-full',
                        isToday ? 'bg-foreground' : 'bg-transparent',
                      )}
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Legend */}
        <View className="border-border gap-2 border-t pt-3">
          <View className="flex-row items-center gap-2">
            <ActivityRings
              size={16}
              animate={false}
              rings={[
                { id: 'routine', done: 1, total: 1 },
                { id: 'measurements', done: 1, total: 1 },
                { id: 'wellbeing', done: 1, total: 1 },
              ]}
            />
            <Text className="text-muted-foreground text-caption flex-1">{t.legendComplete}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="bg-muted h-4 w-4 items-center justify-center rounded-full">
              <Icon as={ShieldCheck} size={10} strokeWidth={2} className="text-muted-foreground" />
            </View>
            <Text className="text-muted-foreground text-caption flex-1">{t.legendProtected}</Text>
          </View>
        </View>
      </View>

      <Text className="text-tertiary text-caption px-1">{t.hint}</Text>
    </Screen>
  );
}
