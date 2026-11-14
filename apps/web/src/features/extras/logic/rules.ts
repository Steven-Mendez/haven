// T03 · Versioned rules: pure helpers to edit an indicator's thresholds on top of a full config.
// No I/O, safe for server and client. Validation codes are translated by the view (i18n.ts).
import {
  type Config,
  evaluate,
  type I18n,
  type Indicator,
  type Level,
  type Reading,
} from '@haven/core';

export type Range = [number, number];

export type EditableRule = {
  /** Position in `Indicator.rules` (order matters: the first rule that matches wins). */
  index: number;
  level: 'amber' | 'red';
  outside: Range;
  withSymptoms: boolean;
  explanation: I18n;
};

/** A numeric indicator as the editor needs it (serialisable, goes to the client). */
export type EditableIndicator = {
  id: string;
  name: I18n;
  zone: string;
  unit: string;
  green: Range;
  /** Rules with an `outside` range (the ones the editor can change). */
  rules: EditableRule[];
  /** Environments with their own `environmentOverrides` (they replace this base reference). */
  overrides: string[];
};

export type RulesEdit = {
  indicator: string;
  green: Range;
  /** Rule index → new `outside` range. */
  outside: Record<number, Range>;
};

export type ThresholdErrorCode = 'number' | 'order' | 'contains' | 'unknown-indicator' | 'engine';
/** `field`: `green`, `rule-<index>` or `indicator`. */
export type ThresholdError = { field: string; code: ThresholdErrorCode };

const isRange = (v: unknown): v is Range =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number');

/** A stored rules version is a full config only if it has the main lists (partial ones are ignored). */
export function isFullConfig(value: unknown): value is Config {
  const c = value as Partial<Config> | null;
  return (
    typeof c === 'object' &&
    c !== null &&
    typeof c.version === 'string' &&
    Array.isArray(c.indicators) &&
    Array.isArray(c.zones) &&
    Array.isArray(c.environments)
  );
}

export function editableIndicators(config: Config): EditableIndicator[] {
  return config.indicators
    .filter((i) => i.kind === 'number' && isRange(i.green))
    .map((i) => ({
      id: i.id,
      name: i.name,
      zone: i.zone,
      unit: i.unit,
      green: [i.green[0], i.green[1]],
      rules: i.rules.flatMap((r, index) =>
        isRange(r.outside)
          ? [
              {
                index,
                level: r.level,
                outside: [r.outside[0], r.outside[1]] as Range,
                withSymptoms: Boolean(r.withSymptoms),
                explanation: r.explanation,
              },
            ]
          : [],
      ),
      overrides: Object.keys(i.environmentOverrides ?? {}),
    }));
}

/** Parses a form number ("3,5" or "3.5"); `undefined` when empty or not a finite number. */
export function parseNumber(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const n = Number(value.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

const contains = (outer: Range, inner: Range) => outer[0] <= inner[0] && outer[1] >= inner[1];

/**
 * Range checks: numbers, min ≤ max, and every rule's `outside` range contains the green range
 * (otherwise a value inside green would already trigger amber or red).
 */
export function validateEdit(indicator: Indicator | undefined, edit: RulesEdit): ThresholdError[] {
  if (indicator?.kind !== 'number' || !indicator)
    return [{ field: 'indicator', code: 'unknown-indicator' }];
  const errors: ThresholdError[] = [];
  const check = (field: string, range: Range) => {
    if (!range.every(Number.isFinite)) errors.push({ field, code: 'number' });
    else if (range[0] > range[1]) errors.push({ field, code: 'order' });
  };
  check('green', edit.green);
  for (const [index, range] of Object.entries(edit.outside)) {
    const field = `rule-${index}`;
    check(field, range);
    const greenOk = !errors.some((e) => e.field === 'green');
    if (greenOk && !errors.some((e) => e.field === field) && !contains(range, edit.green))
      errors.push({ field, code: 'contains' });
  }
  return errors;
}

/**
 * Rewrites the thresholds quoted in a rule explanation («Pulso fuera de la referencia (50–100 lpm)») when
 * its range changes, so the phone never explains a level with the old numbers. Only whole numbers equal to
 * an old bound are replaced (Spanish texts write decimals with a comma). A bound equal to the other one is
 * ambiguous and left as is.
 */
export function rewriteExplanation(text: I18n, from: Range, to: Range): I18n {
  const swaps = [0, 1]
    .filter((i) => from[i] !== to[i] && from[0] !== from[1])
    .map((i) => [from[i], to[i]] as const);
  if (swaps.length === 0) return text;
  const rewrite = (value: string, comma: boolean) => {
    const show = (n: number) => (comma ? String(n).replace('.', ',') : String(n));
    let out = value;
    for (const [old, next] of swaps) {
      const token = show(old).replace(/[.,]/, '[.,]');
      out = out.replace(
        new RegExp(`(?<![\\d.,])${token}(?![\\d]|[.,]\\d)`, 'g'),
        `\u0000${show(next)}`,
      );
    }
    return out.replaceAll('\u0000', '');
  };
  return { ...text, es: rewrite(text.es, true), en: rewrite(text.en, false) };
}

/** New full config with the edited indicator and the given version. The input is not mutated. */
export function applyEdit(config: Config, edit: RulesEdit, version: string): Config {
  return {
    ...config,
    version,
    indicators: config.indicators.map((i) =>
      i.id !== edit.indicator
        ? i
        : {
            ...i,
            green: [edit.green[0], edit.green[1]],
            rules: i.rules.map((r, index) => {
              const outside = edit.outside[index];
              return outside && isRange(r.outside)
                ? {
                    ...r,
                    outside: [outside[0], outside[1]],
                    explanation: rewriteExplanation(r.explanation, r.outside, outside),
                  }
                : r;
            }),
          },
    ),
  };
}

/**
 * Runs the rules engine on the new config with a value at the middle of the green range (no baseline,
 * no symptoms, no environment override). The engine must accept it and the value must be green.
 */
export function engineCheck(
  config: Config,
  indicatorId: string,
  now: Date,
): { ok: boolean; level?: Level } {
  const indicator = config.indicators.find((i) => i.id === indicatorId);
  if (!indicator) return { ok: false };
  const value = (indicator.green[0] + indicator.green[1]) / 2;
  const reading: Reading = {
    id: 'earth-rules-check',
    indicator: indicatorId,
    value,
    unit: indicator.unit,
    takenAt: now.toISOString(),
    source: 'manual',
    simulated: false,
    crewMember: 'earth-rules-check',
  };
  try {
    const assessments = evaluate([reading], config, '', {}, [], now);
    const level = assessments.find((a) => a.indicator === indicatorId)?.level;
    return { ok: level === 'green', level };
  } catch {
    return { ok: false };
  }
}
