import type { ReadingSource as Source } from '@haven/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import {
  ageText,
  BigButton,
  EmptyState,
  format,
  havenTexts,
  LEVEL_TEXT_CLASS,
  LevelSymbol,
  levelLabel,
  levelPhrase,
  sourceLabel,
  TrendDelta,
  useUnitLabel,
  zoneIcon,
} from '@/shared/components/haven';
import { explain, explainAge, explainLevel, InfoTip, Term } from '@/shared/components/info-sheet';
import { ReadingSource } from '@/shared/components/reading-source';
import { useScreenInsets } from '@/shared/components/screen';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text, TextClassContext } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { useAgeMin, useAssessment, useLatestReading, useMission } from '@/shared/data';
import { bus } from '@/shared/events';
import { useLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { EntryBar } from './components/entry-bar';
import { type GuideTab, GuideTabs } from './components/guide-tabs';
import { TrendSection } from './components/trend-section';
import { useCategoryText } from './components/use-category-text';
import { WhyPanel } from './components/why-panel';
import { type IndicatorTexts, texts } from './i18n';
import { formatNumber } from './logic/format';
import { indicatorForEnvironment } from './logic/rule';
import { categoriesOf } from './logic/series';

const ORIGIN_KEY: Partial<Record<Source, keyof IndicatorTexts>> = {
  ship: 'originShip',
  manual: 'originManual',
  watch: 'originWatch',
  healthkit: 'originHealthkit',
  healthconnect: 'originHealthconnect',
  ble: 'originBle',
  screen: 'originScreen',
};

/** Ghost `Button` reduced to its content: no height, padding or pressed fill; 70 % opacity on press. */
const INLINE_TRIGGER =
  'h-auto self-start rounded-none p-0 active:bg-transparent active:opacity-70 sm:h-auto';

/**
 * M02 · Indicator (DESIGN_SYSTEM §8.6): value + badge, one delta line, the data line, the trend
 * with D/W/M, the tabs What to do · How to measure · Why it matters, and «Register» folded in the
 * footer. `?measure=1` (the «Measure» shortcut) opens the entry with the field focused.
 */
export default function Screen() {
  const { id, measure } = useLocalSearchParams<{ id: string; measure?: string }>();
  const t = useTexts(texts);
  const h = useTexts(havenTexts);
  const tr = useTranslate();
  const unitText = useUnitLabel();
  const language = useLanguage();
  const categoryOf = useCategoryText();
  const mission = useMission();
  const insets = useScreenInsets();
  const indicatorId = String(id ?? '');
  const indicator = indicatorForEnvironment(config, indicatorId, mission.environment);
  const assessment = useAssessment(indicatorId);
  const latest = useLatestReading(indicatorId);
  const latestAgeMin = useAgeMin(latest?.takenAt);

  const [tab, setTab] = useState<GuideTab>('whatToDo');
  const [scrub, setScrub] = useState<[number, number] | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const tabsY = useRef(0);

  if (!indicator) {
    return (
      <View className="bg-background flex-1 p-4">
        <Stack.Screen options={{ title: t.title }} />
        <EmptyState
          title={t.notFound}
          description={t.notFoundDescription}
          action={{
            label: t.back,
            onPress: () => (router.canGoBack() ? router.back() : router.replace('/')),
          }}
        />
      </View>
    );
  }

  const zone = config.zones.find((z) => z.id === indicator.zone);
  const level = assessment?.level ?? 'pending';
  const isCategory = indicator.kind === 'category';
  // The hero always shows the LAST known value (assessment value, else the latest reading); a
  // stale one is dimmed with its age, never hidden. «No reading yet» only with zero readings.
  const latestNumber =
    latest && Number.isFinite(Number(latest.value)) ? Number(latest.value) : undefined;
  const lastValue = assessment?.value ?? latestNumber;
  const hasValue = isCategory ? Boolean(latest) : lastValue !== undefined;
  const staleLimitMin = 2 * (indicator.everyHours ?? 12) * 60;
  const stale = latestAgeMin !== undefined && latestAgeMin > staleLimitMin;
  const dimmed = hasValue && (level === 'pending' || stale);
  const shown = !hasValue
    ? '—'
    : isCategory
      ? categoryOf(indicator, String(latest?.value))
      : formatNumber(lastValue as number, language);
  const valueText = hasValue
    ? `${shown}${isCategory ? '' : ` ${unitText(indicator.unit)}`}`
    : t.noReadingYet;
  const isRed = level === 'red';
  const heroValue = scrub
    ? isCategory
      ? categoryOf(indicator, String(categoriesOf(indicator)[Math.round(scrub[1])] ?? ''))
      : formatNumber(scrub[1], language)
    : shown;
  const alerting = assessment && (level === 'amber' || level === 'red');

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Empty bar title: the screen header already names the indicator (and its zone). */}
      <Stack.Screen options={{ title: '' }} />
      <ScrollView
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-7 pt-2"
        contentContainerStyle={{
          paddingBottom: 16,
          paddingLeft: 16 + insets.left,
          paddingRight: 16 + insets.right,
        }}
        keyboardShouldPersistTaps="handled"
        // The iOS navigation bar is translucent: let the system inset the content below it.
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-3">
          <View className="gap-1">
            <View className="flex-row items-center gap-1.5">
              {zone ? (
                <Icon
                  as={zoneIcon(zone.id)}
                  size={14}
                  strokeWidth={2}
                  className="text-muted-foreground"
                />
              ) : null}
              <Text className="text-muted-foreground text-micro font-semibold uppercase">
                {zone ? tr(zone.name) : t.title}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text role="heading" aria-level="1" className="text-title font-bold">
                <Term id={indicator.id}>{tr(indicator.name)}</Term>
              </Text>
              <InfoTip id={indicator.id} label={tr(indicator.name)} />
            </View>
          </View>

          {/* Hero (Garmin / Robinhood): 64 pt figure that follows the scrub, one-word status. */}
          <View className="gap-2">
            <View
              accessible
              accessibilityLabel={`${tr(indicator.name)}: ${
                scrub ? `${heroValue} ${unitText(indicator.unit)}` : valueText
              }`}
              accessibilityLiveRegion="polite"
              className="flex-row items-baseline gap-2"
            >
              {hasValue || scrub ? (
                <>
                  <Text
                    className={cn(
                      'text-metric-xl font-semibold tabular-nums',
                      dimmed && !scrub && 'text-muted-foreground',
                    )}
                  >
                    {heroValue}
                  </Text>
                  {!isCategory ? (
                    <Text className="text-title-sm text-muted-foreground">
                      {unitText(indicator.unit)}
                    </Text>
                  ) : null}
                  {dimmed && !scrub ? (
                    // Age chip: neutral, amber-ish only beyond the indicator's stale rule.
                    <View
                      className={cn(
                        'ml-1 self-center rounded-full border px-2 py-0.5',
                        stale ? 'border-level-amber-border bg-level-amber-bg' : 'border-border',
                      )}
                    >
                      <Text
                        className={cn(
                          'text-caption tabular-nums',
                          stale ? 'text-level-amber' : 'text-muted-foreground',
                        )}
                      >
                        {ageText(h, latestAgeMin)}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text className="text-title text-tertiary font-semibold">{t.noReadingYet}</Text>
              )}
            </View>
            {scrub ? (
              <Text className="text-muted-foreground text-body-sm tabular-nums">
                {new Date(scrub[0]).toLocaleString(language, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            ) : (
              <View className="gap-1.5">
                <Button
                  variant="ghost"
                  accessibilityRole="button"
                  accessibilityHint={t.explainLevelHint}
                  onPress={() => explainLevel(level)}
                  className={cn(INLINE_TRIGGER, 'justify-start gap-2')}
                >
                  {/* Reset Button's text classes: the label keeps its own size, weight and colour. */}
                  <TextClassContext.Provider value={undefined}>
                    <LevelSymbol level={level} size={12} />
                    <Text
                      className={cn(
                        'text-title-sm font-semibold',
                        level === 'pending' ? 'text-muted-foreground' : LEVEL_TEXT_CLASS[level],
                      )}
                    >
                      {levelLabel(h, level)}
                    </Text>
                  </TextClassContext.Provider>
                </Button>
                {hasValue && !isCategory ? (
                  <Button
                    variant="ghost"
                    accessibilityRole="button"
                    accessibilityHint={t.explainLevelHint}
                    onPress={() => explain('baseline')}
                    className={cn(INLINE_TRIGGER, 'flex-col items-stretch justify-start gap-0')}
                  >
                    <TextClassContext.Provider value={undefined}>
                      <TrendDelta
                        value={lastValue}
                        baseline={assessment?.baseline}
                        formatValue={(v) => formatNumber(v, language)}
                      />
                    </TextClassContext.Provider>
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  accessibilityRole="button"
                  accessibilityHint={t.explainLevelHint}
                  onPress={() => explainAge(latest?.takenAt, mission.currentDelayMin)}
                  className={cn(INLINE_TRIGGER, 'flex-col items-stretch justify-start gap-0')}
                >
                  <TextClassContext.Provider value={undefined}>
                    <ReadingSource reading={latest} />
                  </TextClassContext.Provider>
                </Button>
              </View>
            )}
          </View>
        </View>

        {isRed ? (
          <BigButton
            variant="destructive"
            label={t.openProtocol}
            onPress={() => bus.emit('emergency:open', { origin: 'assessment' })}
          />
        ) : null}

        <TrendSection indicator={indicator} assessment={assessment} onScrub={setScrub} />

        <View
          onLayout={(e) => {
            tabsY.current = e.nativeEvent.layout.y;
          }}
        >
          <GuideTabs
            indicator={indicator}
            tab={tab}
            onTabChange={setTab}
            whatToDoTop={
              <View className="gap-3">
                <Text className="text-body-sm">
                  {alerting ? tr(assessment.explanation) : levelPhrase(h, level)}
                </Text>
                {alerting && assessment.actions.length > 0 ? (
                  <View className="gap-1" accessibilityLabel={t.whatToDo}>
                    {assessment.actions.map((a, i) => (
                      <Text key={a.id} className="text-body-sm">
                        {i + 1}. {tr(a.text)}
                      </Text>
                    ))}
                  </View>
                ) : null}
                <WhyPanel indicator={indicator} assessment={assessment} valueText={valueText} />
              </View>
            }
            howToMeasureBottom={
              <View className="gap-2">
                <Text className="text-muted-foreground text-micro font-semibold uppercase">
                  {t.originTitle}
                </Text>
                {latest ? (
                  <>
                    <Text className="text-body">
                      {ORIGIN_KEY[latest.source]
                        ? t[ORIGIN_KEY[latest.source] as keyof IndicatorTexts]
                        : sourceLabel(h, latest.source)}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                      {format(t.originLatest, {
                        n: new Date(latest.takenAt).toLocaleString(language, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }),
                      })}
                    </Text>
                  </>
                ) : (
                  <Text className="text-muted-foreground text-body">{t.originNone}</Text>
                )}
              </View>
            }
          />
        </View>
      </ScrollView>
      <EntryBar indicator={indicator} autoFocus={measure === '1'} secondary={isRed} />
    </KeyboardAvoidingView>
  );
}
