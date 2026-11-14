import {
  BATTERY_INDICATORS,
  type CognitiveVerdict,
  type Config,
  configForEnvironment,
  type Reading,
  type Rule,
} from '@haven/core';
import { router } from 'expo-router';
import { View } from 'react-native';
import {
  BigButton,
  DataLabel,
  format,
  IndicatorCard,
  LevelBadge,
  ScreenHeader,
  Section,
  useUnitLabel,
} from '@/shared/components/haven';
import { Text } from '@/shared/components/ui/text';
import { useTranslate } from '@/shared/i18n';
import type { CognitionTexts } from '../i18n';
import { minutesUntil } from '../logic/battery';
import { More } from './more';
import { WhereFrom } from './where-from';

type Props = {
  t: CognitionTexts;
  verdict: CognitiveVerdict;
  config: Config;
  environment: string;
  linkDown: boolean;
  now: number;
  /** Latest reaction-time reading (false starts live in its note). */
  reaction?: Reading;
  /** Shown when the battery cannot be retaken yet. */
  onRepeat?: () => void;
};

const LABEL: Record<string, keyof CognitionTexts> = {
  'reaction-time': 'reaction',
  'pvt-lapses': 'lapses',
  'working-memory': 'memory',
  'go-nogo-accuracy': 'attention',
};

function falseStarts(note?: string): number | undefined {
  const m = note?.match(/^false-starts:(\d+)$/);
  return m ? Number(m[1]) : undefined;
}

/** Result: verdict, gauges vs. baseline, on-board decision notice, "Why?" with thresholds and version. */
export function ResultView({
  t,
  verdict,
  config,
  environment,
  linkDown,
  now,
  reaction,
  onRepeat,
}: Props) {
  const translate = useTranslate();
  const unitText = useUnitLabel();
  const scoped = configForEnvironment(config, environment);
  const lockMin = minutesUntil(verdict.lockedUntil, now);
  const fs = falseStarts(reaction?.note);

  const describeRule = (rule: Rule, unit: string) =>
    [
      rule.outside
        ? format(t.ruleOutside, { a: rule.outside[0], b: rule.outside[1], unit })
        : undefined,
      rule.baselineDeviation !== undefined
        ? format(t.ruleDeviation, { k: rule.baselineDeviation })
        : undefined,
      rule.repetitions ? format(t.ruleRepetitions, { n: rule.repetitions }) : undefined,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <View className="gap-6">
      {/* Verdict first */}
      <ScreenHeader
        title={t.result}
        subtitle={translate(verdict.explanation)}
        right={<LevelBadge level={verdict.level} size="lg" />}
      />
      {lockMin > 0 ? <Text className="text-body">{format(t.locked, { n: lockMin })}</Text> : null}
      {verdict.notifyEarth ? <Text className="text-body">{t.earthNotified}</Text> : null}
      <Text className="text-muted-foreground text-sm">
        {linkDown ? t.decidedOnBoardLinkDown : t.decidedOnBoard}
      </Text>

      <BigButton
        size="lg"
        label={t.done}
        onPress={() => (router.canGoBack() ? router.back() : router.navigate('/routine'))}
      />
      {onRepeat && lockMin === 0 ? (
        <BigButton label={t.repeat} variant="ghost" onPress={onRepeat} />
      ) : null}

      {/* Detail, folded: gauges vs. baseline, what to do, why, source */}
      <More label={t.detail}>
        {BATTERY_INDICATORS.map((id) => {
          const a = verdict.assessments.find((x) => x.indicator === id);
          const indicator = config.indicators.find((i) => i.id === id);
          if (!a) return null;
          return (
            <IndicatorCard
              key={id}
              name={t[LABEL[id] as keyof CognitionTexts]}
              value={a.value}
              unit={indicator?.unit}
              level={a.level}
              baseline={a.baseline}
              explanation={translate(a.explanation)}
              source="screen"
              ageMin={a.ageMin >= 0 ? a.ageMin : undefined}
              formatValue={(v) => String(Math.round(v))}
            />
          );
        })}
        {fs !== undefined ? (
          <Text className="text-muted-foreground text-sm tabular-nums">
            {format(t.falseStarts, { n: fs })}
          </Text>
        ) : null}
        {verdict.actions.length > 0 ? (
          <Section title={t.whatToDo}>
            {verdict.actions.map((action) => (
              <Text key={action.id} className="text-body">
                · {translate(action.text)}
              </Text>
            ))}
          </Section>
        ) : null}
        <More label={t.why}>
          <Text className="text-body text-muted-foreground">{t.whyIntro}</Text>
          {BATTERY_INDICATORS.map((id) => {
            const indicator = scoped.indicators.find((i) => i.id === id);
            const a = verdict.assessments.find((x) => x.indicator === id);
            if (!indicator) return null;
            return (
              <View key={id} className="gap-1">
                <Text className="text-body font-semibold">{translate(indicator.name)}</Text>
                <Text className="text-muted-foreground text-sm tabular-nums">
                  {format(t.green, {
                    a: indicator.green[0],
                    b: indicator.green[1],
                    unit: unitText(indicator.unit),
                  })}
                </Text>
                {indicator.rules.map((rule, i) => (
                  <Text
                    // biome-ignore lint/suspicious/noArrayIndexKey: rules have no id
                    key={i}
                    className="text-muted-foreground text-sm"
                  >
                    {t.ruleLevel} {describeRule(rule, unitText(indicator.unit))}
                  </Text>
                ))}
                {!a?.baseline ? (
                  <Text className="text-muted-foreground text-sm">{t.noBaseline}</Text>
                ) : null}
              </View>
            );
          })}
          <Text className="text-sm font-semibold">
            {format(t.rulesVersion, { v: config.version })}
          </Text>
        </More>
        <View className="gap-1">
          <DataLabel
            source="screen"
            ageMin={
              reaction
                ? Math.max(0, Math.floor((now - Date.parse(reaction.takenAt)) / 60_000))
                : undefined
            }
          />
          <WhereFrom text={t.whereFrom} />
        </View>
      </More>
    </View>
  );
}
