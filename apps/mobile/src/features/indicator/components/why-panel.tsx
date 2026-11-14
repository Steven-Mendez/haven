import type { Assessment, Indicator } from '@haven/core';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { format, useUnitLabel } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { useLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { type IndicatorTexts, texts } from '../i18n';
import { formatNumber, formatRange } from '../logic/format';
import { appliedRule, type RuleCondition, ruleConditions } from '../logic/rule';
import { useCategoryText } from './use-category-text';
import { useSymptomLabel } from './use-symptom-label';

function describe(
  c: RuleCondition,
  t: IndicatorTexts,
  unit: string,
  language: string,
  labels: { symptom: (v: string) => string; category: (v: string) => string },
): string {
  switch (c.kind) {
    case 'outside':
      return format(t.ruleOutside, { n: `${formatRange(c.range, language)} ${unit}` });
    case 'baselineDeviation':
      return format(t.ruleBaseline, { n: formatNumber(c.factor, language) });
    case 'withSymptoms':
      return c.symptoms.length
        ? format(t.ruleSymptomsList, { n: c.symptoms.map(labels.symptom).join(', ') })
        : t.ruleSymptoms;
    case 'categories':
      return format(t.ruleCategories, { n: c.categories.map(labels.category).join(', ') });
    case 'repetitions':
      return format(t.ruleRepetitions, { n: c.count });
    case 'sustained':
      return format(t.ruleSustained, { n: c.minutes });
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-1">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      <Text className="text-body tabular-nums">{value}</Text>
    </View>
  );
}

/** «Why?» (M02): value, baseline, the rule that matched and the config version. */
export function WhyPanel({
  indicator,
  assessment,
  valueText,
}: {
  indicator: Indicator;
  assessment: Assessment | undefined;
  valueText: string;
}) {
  const t = useTexts(texts);
  const tr = useTranslate();
  const unitText = useUnitLabel();
  const language = useLanguage();
  const symptom = useSymptomLabel();
  const categoryOf = useCategoryText();
  const category = (v: string) => categoryOf(indicator, v);
  const [open, setOpen] = useState(false);

  const level = assessment?.level ?? 'pending';
  const rule = assessment ? appliedRule(indicator, assessment) : undefined;
  const unit = indicator.kind === 'number' ? unitText(indicator.unit) : '';
  const baseline = assessment?.baseline;

  let ruleText: string[];
  if (rule) {
    ruleText = [
      rule.level === 'red' ? t.levelRed : t.levelAmber,
      ...ruleConditions(rule, indicator.kind).map((c) =>
        describe(c, t, unit, language, { symptom, category }),
      ),
    ];
  } else if (level === 'pending') {
    ruleText = [
      indicator.everyHours
        ? format(t.whyPending, { n: indicator.everyHours })
        : t.whyPendingNoFrequency,
    ];
  } else if (level === 'green') {
    ruleText = [t.whyGreen];
  } else {
    ruleText = [t.whyClosing];
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="min-h-touch h-auto w-full justify-between rounded-lg px-4 py-3"
          accessibilityState={{ expanded: open }}
        >
          <Text className="text-body flex-1 text-left font-semibold">{t.why}</Text>
          <Icon as={open ? ChevronUp : ChevronDown} size={20} className="text-foreground" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-3 gap-0 rounded-lg py-0 shadow-none">
          <CardContent className="gap-4 p-4">
            <Row label={t.whyValue} value={valueText} />
            <Row
              label={t.whyBaseline}
              value={
                baseline
                  ? `${format(t.whyBaselineValue, { n: formatNumber(baseline.median, language) })} · ${formatRange(baseline.range, language)} ${unit}`
                  : t.whyBaselineNone
              }
            />
            {indicator.kind === 'number' ? (
              <Row
                label={t.whyReference}
                value={`${formatRange(indicator.green, language)} ${unit}`}
              />
            ) : null}
            <View className="gap-1">
              <Text className="text-muted-foreground text-sm">{t.whyRule}</Text>
              {ruleText.map((line) => (
                <Text key={line} className="text-body">
                  {line}
                </Text>
              ))}
              {rule ? (
                <Text className="text-muted-foreground text-sm">{tr(rule.explanation)}</Text>
              ) : null}
            </View>
            <Row label={t.whyVersion} value={config.version} />
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
