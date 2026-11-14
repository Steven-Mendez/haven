import {
  type Assessment,
  type Config,
  configForEnvironment,
  type Indicator,
  type Rule,
} from '@haven/core';

export function indicatorForEnvironment(
  config: Config,
  indicatorId: string,
  environment: string,
): Indicator | undefined {
  return configForEnvironment(config, environment).indicators.find((i) => i.id === indicatorId);
}

export function appliedRule(indicator: Indicator, assessment: Assessment): Rule | undefined {
  if (assessment.level !== 'amber' && assessment.level !== 'red') return undefined;
  const { es, en } = assessment.explanation;
  return indicator.rules.find(
    (r) => r.level === assessment.level && r.explanation.es === es && r.explanation.en === en,
  );
}

export type RuleCondition =
  | { kind: 'outside'; range: [number, number] }
  | { kind: 'baselineDeviation'; factor: number }
  | { kind: 'withSymptoms'; symptoms: string[] }
  | { kind: 'categories'; categories: string[] }
  | { kind: 'repetitions'; count: number }
  | { kind: 'sustained'; minutes: number };

export function ruleConditions(rule: Rule, kind: Indicator['kind']): RuleCondition[] {
  const out: RuleCondition[] = [];
  if (rule.outside) out.push({ kind: 'outside', range: rule.outside });
  if (rule.baselineDeviation !== undefined) {
    out.push({ kind: 'baselineDeviation', factor: rule.baselineDeviation });
  }
  if (kind === 'category' && rule.categories?.length) {
    out.push({ kind: 'categories', categories: rule.categories });
  }
  if (rule.withSymptoms) {
    out.push({
      kind: 'withSymptoms',
      symptoms: kind === 'number' ? (rule.categories ?? []) : [],
    });
  }
  if (rule.repetitions !== undefined) out.push({ kind: 'repetitions', count: rule.repetitions });
  if (rule.sustainedMin !== undefined) out.push({ kind: 'sustained', minutes: rule.sustainedMin });
  return out;
}
