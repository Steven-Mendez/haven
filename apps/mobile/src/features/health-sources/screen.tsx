import type { Level, ReadingSource } from '@haven/core';
import { router, Stack } from 'expo-router';
import { ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react-native';
import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ageText,
  EmptyState,
  format,
  havenTexts,
  Section,
  sourceLabel,
} from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { useAssessments, useReadings } from '@/shared/data';
import { useTexts, useTranslate } from '@/shared/i18n';
import { useWatch } from '@/shared/watch';
import { IndicatorRow } from './components/indicator-row';
import { ProviderRow } from './components/provider-row';
import { type SourcesTexts, texts } from './i18n';
import {
  type IndicatorPlan,
  latestByIndicator,
  planIndicators,
  type SourceId,
  type SourceState,
  type SourceStatus,
} from './logic/sources';
import {
  refreshSources,
  requestPermission,
  useSourceStatuses,
  writeHealthKitTestSamples,
} from './service';

const STATE_KEY: Record<SourceState, keyof SourcesTexts> = {
  connected: 'stateConnected',
  needsPermission: 'stateNeedsPermission',
  denied: 'stateDenied',
  unavailable: 'stateUnavailable',
  inactive: 'stateInactive',
};

const PROVIDER_NAME: Record<string, keyof SourcesTexts> = {
  healthkit: 'healthkit',
  pedometer: 'pedometer',
  barometer: 'barometer',
  healthconnect: 'healthconnect',
  ble: 'ble',
};

const PROVIDER_SOURCE: Partial<Record<SourceId, ReadingSource>> = {
  pedometer: 'healthkit',
  barometer: 'phone',
};

const WATCH_INDICATORS = ['heart-rate', 'sleep', 'spo2', 'mood'];

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Section title={title}>
      <View className="border-border overflow-hidden rounded-lg border">{children}</View>
      {note ? <Text className="text-tertiary text-caption">{note}</Text> : null}
    </Section>
  );
}

function TestSamplesTool() {
  const t = useTexts(texts);
  const [state, setState] = useState<'idle' | 'writing' | number>('idle');
  return (
    <Group
      title={t.devSection}
      note={typeof state === 'number' ? format(t.devWritten, { n: state }) : t.devNote}
    >
      <Button
        variant="outline"
        className="min-h-touch m-2 h-auto rounded-full sm:h-auto"
        disabled={state === 'writing'}
        onPress={async () => {
          setState('writing');
          try {
            setState(await writeHealthKitTestSamples());
          } catch {
            setState(0);
          }
        }}
      >
        <Text>{state === 'writing' ? t.devWriting : t.devWrite}</Text>
      </Button>
    </Group>
  );
}

export default function Screen() {
  const t = useTexts(texts);
  const ht = useTexts(havenTexts);
  const translate = useTranslate();
  const statuses = useSourceStatuses();
  const watchState = useWatch();
  const assessments = useAssessments();
  const readings = useReadings();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void refreshSources();
  }, []);

  const watchPaired = watchState.source === 'native';
  const watchStatus: SourceStatus = {
    id: 'watch',
    state: watchPaired ? 'connected' : 'inactive',
    indicators: WATCH_INDICATORS,
    primary: [],
    withData: [],
  };

  const latest = useMemo(() => latestByIndicator(readings), [readings]);
  const plans = planIndicators(
    config.indicators.map((i) => i.id),
    [...statuses, watchStatus],
  );
  const levelOf = (plan: IndicatorPlan): Level =>
    plan.mode === 'pending'
      ? 'pending'
      : (assessments.find((a) => a.indicator === plan.indicator)?.level ?? 'pending');

  const groupLabel = (plan: IndicatorPlan) => {
    if (plan.mode === 'pending') return t.planPending;
    if (plan.mode === 'provider')
      return sourceLabel(ht, PROVIDER_SOURCE[plan.source] ?? plan.source);
    const last = latest.get(plan.indicator);
    return last ? sourceLabel(ht, last.source) : t.planNoReading;
  };
  const bySource = new Map<string, IndicatorPlan[]>();
  for (const plan of plans) {
    const key = groupLabel(plan);
    bySource.set(key, [...(bySource.get(key) ?? []), plan]);
  }

  const available = statuses.filter((s) => s.state !== 'unavailable');
  const unavailable = statuses.filter((s) => s.state === 'unavailable');
  const denied = statuses.filter((s) => s.state === 'denied');
  const motionDenied = denied.find((s) => s.id !== 'healthkit');
  const healthKitPresent = statuses.some((s) => s.id === 'healthkit' && s.state !== 'unavailable');
  const reasonOf = (s: SourceStatus) => (s.reason ? (t[s.reason as keyof SourcesTexts] ?? '') : '');
  const syncAge = (s: SourceStatus) =>
    s.lastSyncAt
      ? format(t.lastSync, {
          t: ageText(ht, Math.max(0, Math.round((Date.now() - Date.parse(s.lastSyncAt)) / 60_000))),
        })
      : undefined;

  return (
    <ScrollView
      className="bg-background flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-section px-4 pt-2"
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <Stack.Screen options={{ title: t.title }} />

      {denied.length > 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title={t.deniedTitle}
          description={denied
            .map((s) => (s.id === 'healthkit' ? t.deniedHealthkit : t.deniedPedometer))
            .join('\n\n')}
          action={
            motionDenied
              ? { label: t.grant, onPress: () => void requestPermission(motionDenied.id) }
              : undefined
          }
        />
      ) : null}

      <Group title={t.activeSection}>
        {available.map((s) => (
          <Fragment key={s.id}>
            <ProviderRow
              name={t[PROVIDER_NAME[s.id] ?? 'manual']}
              subtitle={syncAge(s)}
              state={t[STATE_KEY[s.state]]}
              connected={s.state === 'connected'}
              action={
                s.state === 'needsPermission'
                  ? { label: t.grant, onPress: () => void requestPermission(s.id as SourceId) }
                  : undefined
              }
            />
            <View className="bg-border ml-4 h-px" />
          </Fragment>
        ))}
        <ProviderRow
          name={t.watch}
          state={watchPaired ? t.watchPaired : t.watchNotPaired}
          connected={watchPaired}
        />
        <View className="bg-border ml-4 h-px" />
        <ProviderRow name={t.manual} state={t.stateAlways} connected />
      </Group>

      {unavailable.length > 0 ? (
        <Group title={t.unavailableSection} note={t.unavailableNote}>
          <ProviderRow
            name={unavailable.map((s) => t[PROVIDER_NAME[s.id] ?? 'manual']).join(' · ')}
            state={t.stateUnavailable}
            connected={false}
            accessibilityHint={unavailable.map(reasonOf).filter(Boolean).join(' ')}
          />
        </Group>
      ) : null}

      <Group title={t.indicatorsSection}>
        {[...bySource.entries()].map(([label, group], i) => {
          const open = openGroup === label;
          return (
            <Collapsible
              key={label}
              open={open}
              onOpenChange={(next) => setOpenGroup(next ? label : null)}
            >
              {i > 0 ? <View className="bg-border ml-4 h-px" /> : null}
              <CollapsibleTrigger
                accessibilityRole="button"
                accessibilityLabel={`${label}, ${group.length}`}
                className="min-h-row-settings active:bg-active flex-row items-center gap-3 px-4 py-2.5"
              >
                <Text className="text-body-sm flex-1 font-medium">{label}</Text>
                <Text className="text-muted-foreground text-body-sm tabular-nums">
                  {group.length}
                </Text>
                <Icon as={open ? ChevronDown : ChevronRight} size={16} className="text-tertiary" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {group.map((plan) => {
                  const indicator = config.indicators.find((x) => x.id === plan.indicator);
                  return (
                    <Fragment key={plan.indicator}>
                      <View className="bg-border ml-4 h-px" />
                      <IndicatorRow
                        name={indicator ? translate(indicator.name) : plan.indicator}
                        level={levelOf(plan)}
                        latest={latest.get(plan.indicator)}
                        pendingReason={plan.mode === 'pending' ? t.planPending : undefined}
                        onPress={() =>
                          router.push({
                            pathname: '/indicator/[id]',
                            params: { id: plan.indicator },
                          })
                        }
                      />
                    </Fragment>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </Group>

      {__DEV__ && healthKitPresent ? <TestSamplesTool /> : null}
    </ScrollView>
  );
}
