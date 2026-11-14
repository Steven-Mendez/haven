import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { View } from 'react-native';
import {
  ageText,
  DataLabel,
  format,
  havenTexts,
  LevelSymbol,
  SeriesChart,
} from '@/shared/components/haven';
import { Card } from '@/shared/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { useAgeMin, useAssessment, useLatestReading, useReadings } from '@/shared/data';
import { useLanguage, useTexts } from '@/shared/i18n';
import { texts } from '../i18n';

const WINDOW_MS = 10 * 60_000;
const MIN_SPAN_MS = 2 * 60_000;

export function MonitorStrip({
  allowChart = true,
  leading,
}: {
  allowChart?: boolean;
  leading?: ReactNode;
}) {
  const t = useTexts(texts);
  const ht = useTexts(havenTexts);
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const pulses = useReadings('heart-rate');
  const pulse = pulses[pulses.length - 1];
  const spo2 = useLatestReading('spo2');
  const pulseAge = useAgeMin(pulse?.takenAt);
  const spo2Age = useAgeMin(spo2?.takenAt);
  const pulseLevel = useAssessment('heart-rate')?.level;
  const spo2Level = useAssessment('spo2')?.level;
  const now = Date.now();

  const byTime = new Map<number, number>();
  for (const r of pulses) {
    const ms = new Date(r.takenAt).getTime();
    const v = Number(r.value);
    if (ms >= now - WINDOW_MS && Number.isFinite(v)) byTime.set(ms, v);
  }
  const trace = [...byTime.entries()];
  const from = Math.min(now - MIN_SPAN_MS, trace[0]?.[0] ?? now);
  const canChart = allowChart && trace.length > 1;

  return (
    <Collapsible asChild open={canChart && open} onOpenChange={setOpen} disabled={!canChart}>
      <Card
        className={leading ? 'gap-1 rounded-lg py-2 pr-4 pl-1' : 'gap-1 rounded-lg px-1 py-2 pr-4'}
        accessibilityLabel={t.monitor}
      >
        <View className="flex-row items-center gap-1">
          {leading}
          <CollapsibleTrigger
            role={canChart ? 'button' : undefined}
            aria-expanded={canChart ? open : undefined}
            accessibilityState={canChart ? { expanded: open } : { disabled: true }}
            accessibilityHint={canChart ? t.lastMinutes : undefined}
            accessibilityLabel={format(t.monitorLabel, {
              pulse: pulse ? Math.round(Number(pulse.value)) : '—',
              pulseAge: ageText(ht, pulseAge),
              spo2: spo2 ? `${Math.round(Number(spo2.value))} %` : '—',
              spo2Age: ageText(ht, spo2Age),
            })}
            className="min-h-touch flex-1 flex-row items-center justify-between gap-3"
          >
            {pulse ? (
              <View className="flex-row items-baseline gap-2">
                {pulseLevel && pulseLevel !== 'green' ? (
                  <LevelSymbol level={pulseLevel} size={14} />
                ) : null}
                <Text className="text-display font-bold tabular-nums">
                  {Math.round(Number(pulse.value))}
                </Text>
                <Text className="text-muted-foreground text-body">{t.bpm}</Text>
              </View>
            ) : (
              <Text className="text-level-pending text-body flex-1">{t.noPulse}</Text>
            )}
            <View className="flex-row items-center gap-2">
              {spo2 ? (
                <View className="flex-row items-baseline gap-1.5">
                  {spo2Level && spo2Level !== 'green' ? (
                    <LevelSymbol level={spo2Level} size={14} />
                  ) : null}
                  <Text className="text-muted-foreground text-sm">{t.spo2Short}</Text>
                  <Text className="text-title-sm font-semibold tabular-nums">
                    {Math.round(Number(spo2.value))} %
                  </Text>
                  <Text className="text-muted-foreground text-sm tabular-nums">
                    {ageText(ht, spo2Age)}
                  </Text>
                </View>
              ) : (
                <Text className="text-level-pending text-sm">{t.noSpo2}</Text>
              )}
              {canChart ? (
                <Icon
                  as={open ? ChevronUp : ChevronDown}
                  size={18}
                  className="text-muted-foreground"
                />
              ) : null}
            </View>
          </CollapsibleTrigger>
        </View>
        {pulse ? (
          <DataLabel className="pl-3" source={pulse.source} ageMin={pulseAge} simulated={false} />
        ) : null}
        <CollapsibleContent>
          <SeriesChart
            className="mt-1 pl-3"
            data={trace}
            height={96}
            unit={t.bpm}
            lastLevel={pulseLevel}
            timeDomain={[from, now]}
            formatTime={(ms) =>
              new Date(ms).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })
            }
            accessibilityLabel={t.lastMinutes}
          />
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
