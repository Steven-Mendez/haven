import {
  type Assessment,
  actionsDone as countDone,
  dailyProgress,
  overallLevel,
} from '@haven/core';
import { type Href, router } from 'expo-router';
import { ChevronRight, WifiOff } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { ScrollView, View } from 'react-native';
import {
  ActivityRings,
  ageText,
  BigButton,
  BodyFigure,
  format,
  havenTexts,
  IndicatorCard,
  LevelGroups,
  ListGroup,
  levelLabel,
  OriginLink,
  RingSpark,
  Section,
  sourceLabel,
  useMissionPhaseText,
  zoneIcon,
} from '@/shared/components/haven';
import { explain, explainLevel, indicatorContext } from '@/shared/components/info-sheet';
import { ProfileButton } from '@/shared/components/profile-button';
import { useScreenInsets } from '@/shared/components/screen';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Text, TextClassContext } from '@/shared/components/ui/text';
import { baseConfig, config } from '@/shared/config';
import {
  useAgeMin,
  useAssessments,
  useDataReady,
  useMission,
  usePreferences,
  useReadings,
  useZones,
} from '@/shared/data';
import { bus } from '@/shared/events';
import { useGamification } from '@/shared/gamification';
import { useLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { useLayout } from '@/shared/lib/layout';
import { useStartup } from '@/shared/startup';
import { TourAnchor, useAutoStartTour, useTourScroll } from '@/shared/tour';
import { CoachMark } from './components/coach-mark';
import { GettingStarted, type StartRow } from './components/getting-started';
import { type BodyTexts, texts } from './i18n';
import { activeAlerts, hasRed } from './logic/alerts';
import { categoryText } from './logic/category';
import { firstRunSteps } from './logic/first-run';
import { dayPart } from './logic/greeting';
import { latestTakenAt, type NextAction, nextDailyAction } from './logic/next-action';
import { zoneOrigins } from './logic/origins';
import { formatValue } from './logic/value';
import { toggleZone, zoneDetail } from './logic/zone-detail';

/** Alert rows shown before «See all» (DESIGN_SYSTEM §8.5). */
const MAX_ALERT_ROWS = 3;
/** Height of the front silhouette on a 402 pt phone (Tonal aesthetic, one figure); scales with width. */
const FIGURE_HEIGHT = 280;
/** Smaller while there is nothing to colour, so «Getting started» leads the screen. */
const FIGURE_HEIGHT_WAITING = 200;

const SCREENS: Record<string, Href> = {
  cognition: '/cognition',
  wellbeing: '/wellbeing',
  routine: '/routine',
};

function openNext(next: NextAction) {
  if (next.target.kind === 'indicator') {
    router.push({ pathname: '/indicator/[id]', params: { id: next.target.id, measure: '1' } });
  } else {
    router.push(SCREENS[next.target.id] ?? '/routine');
  }
}

const openIndicator = (id: string) => router.push({ pathname: '/indicator/[id]', params: { id } });

const GREETING = {
  morning: 'greetMorning',
  afternoon: 'greetAfternoon',
  evening: 'greetEvening',
  night: 'greetNight',
} as const satisfies Record<string, keyof BodyTexts>;

const ORIGIN_KEY = {
  ship: 'originShip',
  manual: 'originManual',
  watch: 'originWatch',
  healthkit: 'originHealthkit',
  healthconnect: 'originHealthconnect',
  ble: 'originBle',
  screen: 'originScreen',
} as const satisfies Record<string, keyof BodyTexts>;

/**
 * M01 · Body (no top bar): greeting, mission and link status beside the avatar (Withings, Hers), a
 * link strip only when the link is down or sends wait (WHOOP), verdict with one plain sentence (Gentler Streak) and «Open
 * protocol», WHOOP indicator rows (≤ 3 alerts), «Your day» with the next action first (Calm, Withings
 * «Today's Missions»), then the organ figure (Tonal aesthetic) with zone chips and the origin link.
 */
export default function Screen() {
  const t = useTexts(texts);
  const { scale } = useLayout();
  const h = useTexts(havenTexts);
  const tr = useTranslate();
  const language = useLanguage();
  const insets = useScreenInsets();
  const ready = useDataReady();
  const assessments = useAssessments();
  const zones = useZones();
  const readings = useReadings();
  const mission = useMission();
  const { crewMember } = usePreferences();
  const latestAge = useAgeMin(latestTakenAt(readings));
  const g = useGamification();
  const phaseText = useMissionPhaseText();

  const [selected, setSelected] = useState<string | undefined>();
  const [allAlerts, setAllAlerts] = useState(false);
  const [originOpen, setOriginOpen] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const detailY = useRef(0);
  const originY = useRef(0);
  const pendingScroll = useRef<'detail' | 'origin' | null>(null);
  // First-run tour: lets it scroll Body to each target.
  const onTourScroll = useTourScroll('body', scroll);
  useAutoStartTour(useStartup() === 'ready');

  const crewName = mission.crew.find((c) => c.id === crewMember)?.name ?? crewMember;
  const names = Object.fromEntries(config.zones.map((z) => [z.id, tr(z.name)]));

  const alerts = useMemo(() => activeAlerts(assessments, config), [assessments]);
  const detail = selected ? zoneDetail(selected, zones, assessments, config) : undefined;

  // Daily actions: independent from health. Recomputed when readings or assessments refresh
  // (the store re-evaluates every minute), so "today" follows the clock.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `assessments` is the minute tick
  const progress = useMemo(
    () => dailyProgress(readings, config, new Date()),
    [readings, assessments],
  );
  const done = countDone(progress);
  const next = nextDailyAction(progress, zones, config);

  // Latest reading per indicator (readings are sorted by takenAt): source and age of each row.
  const latest = useMemo(() => new Map(readings.map((r) => [r.indicator, r])), [readings]);
  const origins = useMemo(() => zoneOrigins(config, (id) => latest.get(id)), [latest]);

  const scrollTo = (y: number) =>
    scroll.current?.scrollTo({ y: Math.max(0, y - 16), animated: false });

  const showZone = (zone: string) => {
    const nextZone = toggleZone(selected, zone);
    setSelected(nextZone);
    if (!nextZone) return;
    if (selected) requestAnimationFrame(() => scrollTo(detailY.current));
    else pendingScroll.current = 'detail';
  };

  const showOrigin = () => {
    if (originOpen) requestAnimationFrame(() => scrollTo(originY.current));
    else pendingScroll.current = 'origin';
    setOriginOpen(true);
  };

  if (!ready) {
    return (
      <View className="bg-background flex-1 gap-6 p-4" accessibilityLabel={t.loading}>
        <View className="gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-64" />
        </View>
        <View className="items-center py-2">
          <Skeleton className="h-[280px] w-[142px] rounded-[48px]" />
        </View>
        <View className="gap-3">
          <Skeleton className="h-4 w-28" />
          <View className="flex-row gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-16" />
          </View>
        </View>
        <View className="border-border rounded-lg border">
          {[0, 1, 2].map((i) => (
            <View key={i} className="min-h-row-indicator flex-row items-center gap-3 px-4">
              <View className="flex-1 gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-16" />
              </View>
              <Skeleton className="h-6 w-14" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  const noData = readings.length === 0;
  const red = hasRed(alerts);
  const overall = overallLevel(assessments);
  const redCount = alerts.filter((a) => a.assessment.level === 'red').length;
  const age = latestAge === undefined ? undefined : ageText(h, latestAge);
  const verdict = noData
    ? t.verdictWelcome
    : overall === 'green'
      ? t.verdictGreen
      : overall === 'pending'
        ? t.verdictPending
        : levelLabel(h, overall);
  const now = new Date();
  // No top bar (Withings, Hers): greeting and mission sit beside the link button and the avatar.
  const greeting = [t[GREETING[dayPart(now.getHours())]], crewName?.split(' ')[0]]
    .filter(Boolean)
    .join(', ');
  const missionLine = [mission.name ?? mission.code, phaseText(mission)].join(' · ');
  // Link down: one strip above the verdict (WHOOP «Data catching up»). Packets waiting to leave are not
  // the astronaut's concern: they go out on their own (the queue is only reachable from Settings).
  const linkNote = mission.linkDown ? h.linkDown : '';
  const hint = noData
    ? undefined
    : overall === 'green'
      ? t.verdictHintGreen
      : overall === 'pending'
        ? t.verdictHintPending
        : overall === 'amber'
          ? t.verdictHintAmber
          : undefined;
  const summary = red
    ? format(redCount === 1 ? t.summaryRedOne : t.summaryRed, { n: redCount })
    : alerts.length > 0
      ? format(t.summaryAmber, { n: alerts.length })
      : undefined;

  // One data line for the whole alert list: sources · newest age.
  const alertReadings = alerts
    .map((a) => latest.get(a.indicator.id))
    .filter((r) => r !== undefined);
  const alertSources = [...new Set(alertReadings.map((r) => sourceLabel(h, r.source)))];
  const alertNewest = latestTakenAt(alertReadings);
  const alertAge =
    alertNewest === undefined
      ? undefined
      : ageText(h, Math.max(0, (Date.now() - new Date(alertNewest).getTime()) / 60_000));
  const startRows: StartRow[] = firstRunSteps({
    readings: readings.length,
    next,
    crew: mission.crew,
    crewMember,
  }).map((step): StartRow => {
    switch (step.id) {
      case 'measure':
        return {
          key: step.id,
          icon: 'measure',
          title: t.startMeasure,
          detail: tr(step.next.zone.dailyAction.text),
          onPress: () => openNext(step.next),
        };
      case 'sources':
        return {
          key: step.id,
          icon: 'sources',
          title: t.startSources,
          detail: t.startSourcesDetail,
          onPress: () => router.push('/sources'),
        };
      default: // 'who'
        return {
          key: step.id,
          icon: 'who',
          title: t.startWho,
          detail: t.startWhoDetail,
          onPress: () => router.push('/mission'),
        };
    }
  });
  const shownAlerts = allAlerts ? alerts : alerts.slice(0, MAX_ALERT_ROWS);

  // Zones grouped by level for the chips under the figure (Emergency → Check → In range → Pending).
  const zoneGroups: Partial<
    Record<
      'red' | 'amber' | 'green' | 'pending',
      {
        id: string;
        label: string;
        selected?: boolean;
      }[]
    >
  > = {};
  for (const z of config.zones) {
    const level = zones.find((x) => x.zone === z.id)?.level ?? 'pending';
    const list = zoneGroups[level] ?? [];
    list.push({ id: z.id, label: tr(z.name), selected: selected === z.id });
    zoneGroups[level] = list;
  }

  const row = (indicatorId: string, assessment: Assessment | undefined) => {
    const indicator = config.indicators.find((i) => i.id === indicatorId);
    if (!indicator) return null;
    const reading = latest.get(indicatorId);
    const level = assessment?.level ?? 'pending';
    const value =
      level === 'pending'
        ? undefined
        : indicator.kind === 'category'
          ? reading
            ? categoryText(
                indicator,
                baseConfig.indicators.find((i) => i.id === indicatorId),
                String(reading.value),
                language,
              )
            : undefined
          : assessment?.value;
    return (
      <IndicatorCard
        key={indicatorId}
        variant="row"
        grouped
        icon={zoneIcon(indicator.zone)}
        name={tr(indicator.name)}
        value={value}
        unit={indicator.kind === 'category' ? undefined : indicator.unit}
        level={level}
        baseline={assessment?.baseline}
        source={reading?.source}
        ageMin={
          reading
            ? Math.max(0, (Date.now() - new Date(reading.takenAt).getTime()) / 60_000)
            : undefined
        }
        simulated={false}
        formatValue={(v) => formatValue(v, language)}
        onPress={() => openIndicator(indicatorId)}
        onLongPress={() =>
          indicatorContext(indicatorId, level, [
            { label: h.openDetails, onPress: () => openIndicator(indicatorId) },
            {
              label: h.registerValue,
              onPress: () =>
                router.push({
                  pathname: '/indicator/[id]',
                  params: { id: indicatorId, measure: '1' },
                }),
            },
          ])
        }
      />
    );
  };

  return (
    <ScrollView
      ref={scroll}
      onScroll={onTourScroll}
      scrollEventThrottle={32}
      className="bg-background flex-1"
      contentContainerClassName="gap-8 px-4 pt-3"
      contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-body font-semibold">{greeting}</Text>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-muted-foreground text-caption shrink" numberOfLines={1}>
              {`${missionLine} ·`}
            </Text>
            {/* Link status in words: an antenna icon alone was not understood. */}
            <View className="flex-row items-center gap-1.5">
              <View
                className={
                  mission.linkDown
                    ? 'border-muted-foreground h-2 w-2 rounded-full border'
                    : 'bg-level-green h-2 w-2 rounded-full'
                }
              />
              <Text
                className={
                  mission.linkDown
                    ? 'text-foreground text-caption font-medium'
                    : 'text-muted-foreground text-caption'
                }
              >
                {mission.linkDown ? h.linkDownShort : h.linkUp}
              </Text>
            </View>
          </View>
        </View>
        <TourAnchor step="profile">
          <ProfileButton />
        </TourAnchor>
      </View>

      {linkNote ? (
        <Button
          variant="ghost"
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/mission', params: { focus: 'link' } })}
          className="bg-muted active:bg-active min-h-touch h-auto justify-start gap-3 rounded-lg px-4 py-2 sm:h-auto"
        >
          <TextClassContext.Provider value={undefined}>
            <Icon as={WifiOff} size={18} strokeWidth={1.75} className="text-foreground" />
            <Text className="text-body-sm flex-1 font-medium">{linkNote}</Text>
            <Icon as={ChevronRight} size={16} className="text-tertiary" />
          </TextClassContext.Provider>
        </Button>
      ) : null}

      {/* 1 · Verdict (Tonal title: big, bold, left) and the one main action. */}
      <TourAnchor step="verdict" fill>
        <View className="gap-4">
          <View className="gap-1.5">
            <Text role="heading" aria-level="1" className="text-[34px] leading-[40px] font-bold">
              {verdict}
            </Text>
            {hint ? <Text className="text-body">{hint}</Text> : null}
            {summary || age ? (
              <Text className="text-tertiary text-caption tabular-nums">
                {[summary, age].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
          {red ? (
            <BigButton
              variant="destructive"
              label={t.openProtocol}
              onPress={() => bus.emit('emergency:open', { origin: 'assessment' })}
            />
          ) : null}
        </View>
      </TourAnchor>

      {/* 2 · Needs attention, right under the verdict (WHOOP «Elevated HRV»): at most three rows. */}
      {alerts.length > 0 ? (
        <TourAnchor step="alerts" fill>
          <Section
            title={t.alerts}
            count={alerts.length}
            action={
              alerts.length > MAX_ALERT_ROWS
                ? {
                    label: allAlerts ? t.showLess : format(t.seeAllAlerts, { n: alerts.length }),
                    onPress: () => setAllAlerts((v) => !v),
                  }
                : undefined
            }
          >
            <ListGroup inset={52}>
              {shownAlerts.map(({ assessment, indicator }) => row(indicator.id, assessment))}
            </ListGroup>
            {alertSources.length > 0 ? (
              <Text className="text-tertiary text-caption">
                {[alertSources.join(', '), alertAge].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </Section>
        </TourAnchor>
      ) : null}

      {startRows.length > 0 ? (
        <TourAnchor step="start" fill>
          <GettingStarted title={t.startTitle} body={t.startBody} rows={startRows} />
        </TourAnchor>
      ) : null}

      {/* 3 · Your day (Calm «Your day», Withings «Today's Missions»): the next action leads, the
          rings and streak sit under it. Progress, not health. Before the first reading «Getting
          started» already offers the action, so only the rings show. */}
      <Section title={t.yourDay}>
        <View className="border-border bg-elevated overflow-hidden rounded-lg border">
          {noData ? null : next ? (
            <TourAnchor step="next" fill>
              <View className="border-border gap-3 border-b p-4">
                <View className="gap-1">
                  <Text className="text-muted-foreground text-caption font-medium uppercase">
                    {t.nextUp}
                  </Text>
                  <Text className="text-body font-semibold">{tr(next.zone.dailyAction.text)}</Text>
                </View>
                <Button
                  accessibilityRole="button"
                  onPress={() => openNext(next)}
                  className="min-h-touch h-auto self-start rounded-full px-5 py-0 sm:h-auto"
                >
                  <Text className="text-primary-foreground text-body-sm font-semibold">
                    {next.target.kind === 'indicator' ? t.measure : t.start}
                  </Text>
                </Button>
              </View>
            </TourAnchor>
          ) : (
            <Text className="text-muted-foreground text-body-sm border-border border-b p-4">
              {t.dayComplete}
            </Text>
          )}
          <Button
            variant="ghost"
            accessibilityRole="button"
            accessibilityLabel={`${format(h.ringSummary, { n: done })} ${t.openRoutine}`}
            onPress={() => router.push('/routine')}
            className="active:bg-active h-auto justify-start gap-4 rounded-none px-4 py-3 sm:h-auto"
          >
            {/* Reset Button's text classes: the row keeps its own type and colours. */}
            <TextClassContext.Provider value={undefined}>
              <ActivityRings
                size={56}
                rings={[
                  { id: 'routine', ...g.today.routine },
                  { id: 'measurements', ...g.today.measurements },
                  { id: 'wellbeing', ...g.today.wellbeing },
                ]}
              />
              <View className="flex-1 gap-1">
                <Text className="text-body-sm font-semibold tabular-nums">
                  {format(t.dayOf, { n: done })} · {t.openRoutine}
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <RingSpark size={14} strokeWidth={2} />
                  <Text className="text-muted-foreground text-caption tabular-nums">
                    {format(t.streakChip, { n: g.streak })}
                  </Text>
                </View>
              </View>
              <Icon as={ChevronRight} size={16} className="text-tertiary" />
            </TextClassContext.Provider>
          </Button>
        </View>
      </Section>

      {/* 4 · Front figure, zones filled with their level colour (Tonal aesthetic). Before the
          first reading it is a quiet preview: every zone is pending, so no chips or coach mark. */}
      <View className={noData ? 'gap-3 opacity-60' : 'gap-6'}>
        <TourAnchor step="figure" fill>
          <BodyFigure
            zones={zones}
            selected={selected}
            names={names}
            onPressZone={(zone) => showZone(zone)}
            height={Math.round((noData ? FIGURE_HEIGHT_WAITING : FIGURE_HEIGHT) * scale)}
            showLegend={false}
          />
        </TourAnchor>
        {noData ? (
          <Text className="text-muted-foreground text-caption text-center">{t.figureWaiting}</Text>
        ) : (
          <CoachMark text={t.coachFigure} dismissLabel={t.coachDismiss} />
        )}
      </View>

      {/* 5 · Level sections with one chip per zone; a chip opens the zone in place. */}
      {noData ? null : (
        <LevelGroups
          groups={zoneGroups}
          onPressItem={(zone) => showZone(zone)}
          onLongPressItem={(zone) => explain(zone)}
          onPressLevel={explainLevel}
        />
      )}

      {detail ? (
        <View
          onLayout={(e) => {
            detailY.current = e.nativeEvent.layout.y;
            if (pendingScroll.current === 'detail') {
              pendingScroll.current = null;
              scrollTo(detailY.current);
            }
          }}
        >
          <Section
            title={tr(detail.zone.name)}
            action={{ label: t.closeZone, onPress: () => setSelected(undefined) }}
          >
            <Text className="text-muted-foreground text-body-sm">{tr(detail.zone.purpose)}</Text>
            <ListGroup inset={52}>
              {detail.indicators.map(({ indicator, assessment }) => row(indicator.id, assessment))}
            </ListGroup>
          </Section>
        </View>
      ) : null}

      {originOpen ? (
        <View
          onLayout={(e) => {
            originY.current = e.nativeEvent.layout.y;
            if (pendingScroll.current === 'origin') {
              pendingScroll.current = null;
              scrollTo(originY.current);
            }
          }}
        >
          <Section
            title={t.originTitle}
            action={{ label: t.closeZone, onPress: () => setOriginOpen(false) }}
          >
            <ListGroup>
              {origins.map((o) => (
                <View key={o.zone} className="gap-1 px-4 py-3">
                  <Text className="text-body-sm font-medium">{names[o.zone]}</Text>
                  {o.sources.length === 0 ? (
                    <Text className="text-tertiary text-caption">{t.originNone}</Text>
                  ) : (
                    o.sources.map((s) => (
                      <Text key={s} className="text-muted-foreground text-caption">
                        {s in ORIGIN_KEY
                          ? t[ORIGIN_KEY[s as keyof typeof ORIGIN_KEY]]
                          : sourceLabel(h, s)}
                      </Text>
                    ))
                  )}
                </View>
              ))}
            </ListGroup>
          </Section>
        </View>
      ) : (
        <OriginLink onPress={showOrigin} />
      )}
    </ScrollView>
  );
}
