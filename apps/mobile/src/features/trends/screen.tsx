import type { Level } from '@haven/core';
import { router } from 'expo-router';
import { ChartLine, ChevronLeft, ChevronRight, Send } from 'lucide-react-native';
import { type ComponentRef, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  type ChartEvent,
  EmptyState,
  format,
  ListDataLabel,
  ListGroup,
  ScreenHeader,
  Section,
  SegmentedControl,
} from '@/shared/components/haven';
import { ProfileButton } from '@/shared/components/profile-button';
import { useScreenInsets } from '@/shared/components/screen';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { store, useAssessments, useDataReady, useMission } from '@/shared/data';
import { useEvent } from '@/shared/events';
import { useTexts, useTranslate } from '@/shared/i18n';
import { TourAnchor, useTourScroll } from '@/shared/tour';
import { LevelSummary } from './components/level-summary';
import { TrendCard } from './components/trend-card';
import { TrendRow } from './components/trend-row';
import { useTrendMarkers } from './hooks/markers';
import { texts } from './i18n';
import { groupByZone, levelCounts } from './logic/groups';
import { markersInWindow } from './logic/markers';
import { firstReadingMs, rangeWindow, TREND_RANGES, type TrendRange } from './logic/series';

const DAY_MS = 86_400_000;
const NOW_STEP_MS = 5_000;

export default function Screen() {
  const t = useTexts(texts);
  const translate = useTranslate();
  const insets = useScreenInsets();
  const ready = useDataReady();
  const mission = useMission();
  const assessments = useAssessments();
  const markers = useTrendMarkers();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const onTourScroll = useTourScroll('trends', scroll);
  const [selected, setSelected] = useState<string | undefined>();
  const [range, setRange] = useState<TrendRange>('mission');
  const [now, setNow] = useState(() => Date.now());

  useEvent('reading:new', () => {
    const next = Date.now();
    if (next - now >= NOW_STEP_MS) setNow(next);
  });
  useEvent('mission:changed', () => setNow(Date.now()));
  useEvent('emergency:open', () => setNow(Date.now()));

  const numeric = config.indicators.filter((i) => i.kind === 'number');
  const levelOf = (id: string): Level =>
    assessments.find((a) => a.indicator === id)?.level ?? 'pending';
  const withData = numeric.filter((i) => store.readings({ indicator: i.id }).length > 0);
  const groups = groupByZone(
    withData,
    levelOf,
    config.zones.map((z) => z.id),
  );
  const counts = levelCounts(withData.map((i) => levelOf(i.id)));
  const shownAssessments = assessments.filter((a) => withData.some((i) => i.id === a.indicator));
  const sources = [
    ...new Set(
      withData
        .map((i) => store.latestReading(i.id)?.source)
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    ),
  ];
  const newestAge = Math.min(
    ...shownAssessments.map((a) => a.ageMin).filter((m) => m >= 0),
    Number.POSITIVE_INFINITY,
  );

  const indicator = numeric.find((i) => i.id === selected);
  const zone = config.zones.find((z) => z.id === indicator?.zone);

  const missionStartMs = useMemo(() => {
    const dayOne = now - (Math.max(1, mission.day) - 1) * DAY_MS;
    if (!selected) return dayOne;
    const first = firstReadingMs(store.readings({ indicator: selected }).slice(0, 1));
    return Math.max(dayOne, first ?? dayOne);
  }, [selected, mission.day, now]);
  const window = useMemo(
    () => rangeWindow(range, now, missionStartMs),
    [range, now, missionStartMs],
  );

  const events = useMemo<ChartEvent[]>(() => {
    return markersInWindow(markers, window).map((m) => {
      if (m.kind === 'emergency') return { t: m.t, label: t.markerEmergency, kind: 'emergency' };
      const env = config.environments.find((e) => e.id === m.ref);
      return { t: m.t, label: env ? translate(env.name) : m.ref, kind: 'environment' };
    });
  }, [markers, window, t, translate]);

  const rangeLabel: Record<TrendRange, string> = {
    day: t.rangeDay,
    week: t.rangeWeek,
    mission: t.rangeMission,
  };

  const select = (id: string | undefined) => {
    setSelected(id);
    setNow(Date.now());
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const row = (i: (typeof numeric)[number]) => (
    <TrendRow
      key={i.id}
      indicator={i}
      grouped
      level={levelOf(i.id)}
      now={now}
      onPress={() => select(i.id)}
    />
  );

  return (
    <ScrollView
      ref={scroll}
      onScroll={onTourScroll}
      scrollEventThrottle={32}
      className="bg-background flex-1"
      contentContainerClassName="gap-6"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom,
        paddingLeft: 16 + insets.left,
        paddingRight: 16 + insets.right,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {indicator ? (
        <>
          <View className="gap-2">
            <Button
              variant="ghost"
              onPress={() => select(undefined)}
              className="min-h-touch h-auto flex-row gap-1 self-start px-0 sm:h-auto"
              accessibilityLabel={t.title}
            >
              <Icon as={ChevronLeft} size={20} className="text-link" />
              <Text className="text-link text-body-sm font-medium">{t.title}</Text>
            </Button>
            <View className="gap-1">
              {zone ? (
                <Text className="text-muted-foreground text-micro font-semibold uppercase">
                  {translate(zone.name)}
                </Text>
              ) : null}
              <Text role="heading" aria-level="1" className="text-title font-bold">
                {translate(indicator.name)}
              </Text>
            </View>
          </View>

          <TrendCard
            indicator={indicator}
            range={range}
            window={window}
            events={events}
            controls={
              <SegmentedControl
                options={TREND_RANGES.map((r) => ({ value: r, label: rangeLabel[r] }))}
                value={range}
                onChange={setRange}
                accessibilityLabel={t.rangeLabel}
              />
            }
          />
        </>
      ) : (
        <>
          <ScreenHeader title={t.title} right={<ProfileButton />} />

          {!ready ? (
            <View className="border-border rounded-lg border">
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} className="min-h-row-indicator flex-row items-center gap-3 px-4">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <View className="flex-1 gap-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-14" />
                  </View>
                  <Skeleton className="h-5 w-14" />
                  <Skeleton className="h-6 w-14" />
                </View>
              ))}
            </View>
          ) : withData.length === 0 ? (
            <TourAnchor step="trends-list" fill>
              <EmptyState
                icon={ChartLine}
                title={t.noDataTitle}
                description={t.noDataBody}
                action={{ label: t.noDataSources, onPress: () => router.push('/sources') }}
                secondaryAction={{ label: t.noDataRoutine, onPress: () => router.push('/routine') }}
              />
            </TourAnchor>
          ) : (
            <View className="gap-6">
              <LevelSummary
                counts={counts}
                title={format(t.summaryTitle, { n: withData.length })}
              />
              {groups.map((group, i) => {
                const groupZone = config.zones.find((z) => z.id === group.zone);
                const section = (
                  <Section
                    key={group.zone}
                    title={groupZone ? translate(groupZone.name) : group.zone}
                    count={group.items.length}
                  >
                    <ListGroup inset={16}>{group.items.map(row)}</ListGroup>
                  </Section>
                );
                return i === 0 ? (
                  <TourAnchor key={group.zone} step="trends-list" fill>
                    {section}
                  </TourAnchor>
                ) : (
                  section
                );
              })}
              <ListDataLabel
                sources={sources}
                ageMin={Number.isFinite(newestAge) ? newestAge : undefined}
              />
            </View>
          )}

          <ListGroup>
            <Button
              variant="ghost"
              onPress={() => router.push('/send')}
              accessibilityRole="button"
              accessibilityLabel={`${t.export}. ${mission.linkDown ? t.exportLinkDown : t.exportDetail}`}
              className="active:bg-active min-h-row h-auto justify-start gap-3 rounded-none px-4 py-2 sm:h-auto"
            >
              <Icon
                as={Send}
                size={20}
                strokeWidth={1.75}
                className="text-muted-foreground group-active:text-muted-foreground"
              />
              <View className="flex-1 gap-0.5">
                <Text className="text-body-sm font-medium">{t.export}</Text>
                <Text
                  className="text-tertiary text-caption group-active:text-tertiary font-normal"
                  numberOfLines={1}
                >
                  {mission.linkDown ? t.exportLinkDown : t.exportDetail}
                </Text>
              </View>
              <Icon
                as={ChevronRight}
                size={16}
                className="text-tertiary group-active:text-tertiary"
              />
            </Button>
          </ListGroup>
        </>
      )}
    </ScrollView>
  );
}
