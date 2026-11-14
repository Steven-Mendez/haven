import type { Action, Assessment, Config, I18n, Indicator, Reading, Rule } from '../contracts';
import { ACTION_RECORD, ACTION_REPEAT, defaultActionCatalog, resolveActions } from './actions';
import { type Baseline, baselineWidth } from './baseline';
import { LEVEL_ORDER, MIN_MS, ms, numeric, series } from './util';

const SYMPTOM_INDICATOR = 'symptom';
const NO_SYMPTOM = new Set(['', 'none', 'no', 'ninguno']);

export type EvaluateOptions = {
  actions?: Action[];
  symptomWindowMin?: number;
  defaultEveryHours?: number;
  freshnessFactor?: number;
};

export const NO_DATA_AGE_MIN = -1;

export function configForEnvironment(config: Config, environment: string): Config {
  return {
    ...config,
    indicators: config.indicators.map((i) => {
      const o = i.environmentOverrides?.[environment];
      if (!o) return i;
      return { ...i, green: o.green ?? i.green, rules: o.rules ?? i.rules };
    }),
  };
}

export function categoryLabel(
  indicator: Pick<Indicator, 'categoryLabels'>,
  value: number | string,
  lang: keyof I18n,
): string {
  const key = String(value);
  return indicator.categoryLabels?.[key]?.[lang] ?? key;
}

export function activeSymptoms(symptoms: Reading[], now: Date, windowMin = 360): Reading[] {
  const end = now.getTime();
  const start = end - windowMin * MIN_MS;
  const seen = new Set<string>();
  return symptoms.filter((s) => {
    const t = ms(s.takenAt);
    if (s.indicator !== SYMPTOM_INDICATOR || t > end || t < start) return false;
    if (NO_SYMPTOM.has(String(s.value).trim().toLowerCase())) return false;
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

export function evaluate(
  readings: Reading[],
  config: Config,
  environment: string,
  baseline: Record<string, Assessment['baseline']>,
  symptoms: Reading[],
  now: Date = new Date(),
  options?: EvaluateOptions,
): Assessment[] {
  const cfg = configForEnvironment(config, environment);
  const catalog = options?.actions ?? defaultActionCatalog();
  const active = activeSymptoms(
    [...symptoms, ...readings.filter((r) => r.indicator === SYMPTOM_INDICATOR)],
    now,
    options?.symptomWindowMin,
  );
  return cfg.indicators
    .filter((ind) => !ind.extra)
    .map((ind) =>
      evaluateIndicator(ind, readings, baseline[ind.id], active, now, catalog, options),
    );
}

type Match = 'yes' | 'waiting' | 'no';

function evaluateIndicator(
  ind: Indicator,
  readings: Reading[],
  b: Baseline | undefined,
  symptoms: Reading[],
  now: Date,
  catalog: Action[],
  options?: EvaluateOptions,
): Assessment {
  const s = series(readings, ind.id, now).filter((r) =>
    ind.kind === 'number' ? numeric(r) !== undefined : String(r.value).length > 0,
  );
  const last = s.at(-1);
  if (!last) {
    return {
      indicator: ind.id,
      level: 'pending',
      baseline: b,
      explanation: {
        es: 'Sin lecturas todavía: el estado queda pendiente hasta que midas.',
        en: 'No readings yet: the status stays pending until you measure.',
      },
      actions: resolveActions([ACTION_RECORD], catalog),
      ageMin: NO_DATA_AGE_MIN,
      simulated: false,
    };
  }

  const ageMin = Math.max(0, Math.floor((now.getTime() - ms(last.takenAt)) / MIN_MS));
  const freshMin =
    (ind.everyHours ?? options?.defaultEveryHours ?? 24) * (options?.freshnessFactor ?? 1.5) * 60;
  const value = ind.kind === 'number' ? numeric(last) : undefined;
  const base = { indicator: ind.id, baseline: b, ageMin, simulated: last.simulated };

  if (ageMin > freshMin) {
    const hours = Math.round(ageMin / 60);
    return {
      ...base,
      level: 'pending',
      explanation: {
        es: `La última lectura es de hace ${hours} h y ya no está vigente: vuelve a medir.`,
        en: `The last reading is ${hours} h old and no longer current: measure again.`,
      },
      actions: resolveActions([ACTION_RECORD], catalog),
    };
  }

  const results = ind.rules.map((rule, order) => ({
    rule,
    order,
    match: matchRule(rule, ind, s, b, symptoms),
  }));
  const winner = results
    .filter((r) => r.match === 'yes')
    .sort((a, c) => LEVEL_ORDER[c.rule.level] - LEVEL_ORDER[a.rule.level] || a.order - c.order)[0];
  if (winner) {
    return {
      ...base,
      value,
      level: winner.rule.level,
      explanation: winner.rule.explanation,
      actions: resolveActions(winner.rule.actions, catalog),
    };
  }

  const outsideGreen =
    ind.kind === 'number' && value !== undefined && (value < ind.green[0] || value > ind.green[1]);
  const waiting = results.find((r) => r.match === 'waiting');
  const ref = `${fmt(ind.green[0])}–${fmt(ind.green[1])} ${ind.unit}`.trim();

  if (outsideGreen && !waiting) {
    return {
      ...base,
      value,
      level: 'amber',
      explanation: {
        es: `${fmt(value)} ${ind.unit} está fuera de la referencia (${ref}). Repite la medición y, si se mantiene, repórtalo en la próxima ventana.`,
        en: `${fmt(value)} ${ind.unit} is outside the reference (${ref}). Repeat the measurement and, if it persists, report it in the next window.`,
      },
      actions: resolveActions([ACTION_REPEAT], catalog),
    };
  }
  if (outsideGreen && waiting) {
    return {
      ...base,
      value,
      level: 'green',
      explanation: watchingText(waiting.rule, ind, value, ref),
      actions: [],
    };
  }
  return {
    ...base,
    value,
    level: 'green',
    explanation:
      b && value !== undefined
        ? {
            es: `Dentro de la referencia y de tu rango habitual (mediana ${fmt(b.median)} ${ind.unit}).`,
            en: `Within the reference and your usual range (median ${fmt(b.median)} ${ind.unit}).`,
          }
        : ind.kind === 'number'
          ? { es: `Dentro de la referencia (${ref}).`, en: `Within the reference (${ref}).` }
          : {
              es: `Sin hallazgos (${categoryLabel(ind, last.value, 'es')}).`,
              en: `No findings (${categoryLabel(ind, last.value, 'en')}).`,
            },
    actions: [],
  };
}

function matchRule(
  rule: Rule,
  ind: Indicator,
  s: Reading[],
  b: Baseline | undefined,
  symptoms: Reading[],
): Match {
  const meets = (r: Reading): boolean => valueCondition(rule, ind, r, b);
  const last = s.at(-1);
  if (!last || !meets(last)) return 'no';

  if (rule.withSymptoms) {
    const filter = ind.kind === 'number' && rule.categories?.length ? rule.categories : undefined;
    if (!symptoms.some((x) => !filter || filter.includes(String(x.value)))) return 'no';
  }

  const needsReps = rule.repetitions !== undefined && rule.repetitions > 1;
  const needsSustained = rule.sustainedMin !== undefined && rule.sustainedMin > 0;
  if (!needsReps && !needsSustained) return 'yes';

  let repsOk = false;
  if (needsReps) {
    const n = rule.repetitions as number;
    const lastN = s.slice(-n);
    repsOk = lastN.length === n && lastN.every(meets);
  }
  let sustainedOk = false;
  if (needsSustained) {
    let start = ms(last.takenAt);
    for (let i = s.length - 1; i >= 0; i--) {
      const r = s[i] as Reading;
      if (!meets(r)) break;
      start = ms(r.takenAt);
    }
    sustainedOk = (ms(last.takenAt) - start) / MIN_MS >= (rule.sustainedMin as number);
  }
  return repsOk || sustainedOk ? 'yes' : 'waiting';
}

function valueCondition(rule: Rule, ind: Indicator, r: Reading, b: Baseline | undefined): boolean {
  if (ind.kind === 'category') {
    if (rule.categories?.length) return rule.categories.includes(String(r.value));
    return rule.withSymptoms === true && rule.outside === undefined;
  }
  const v = numeric(r);
  if (v === undefined) return false;
  if (rule.outside && v >= rule.outside[0] && v <= rule.outside[1]) return false;
  if (rule.baselineDeviation !== undefined) {
    if (!b) return false;
    if (Math.abs(v - b.median) <= rule.baselineDeviation * baselineWidth(b)) return false;
  }
  return true;
}

function watchingText(rule: Rule, ind: Indicator, value: number | undefined, ref: string): I18n {
  const req: I18n[] = [];
  if (rule.repetitions) {
    req.push({
      es: `${rule.repetitions} lecturas seguidas`,
      en: `${rule.repetitions} readings in a row`,
    });
  }
  if (rule.sustainedMin) {
    req.push({
      es: `${rule.sustainedMin} min sostenido`,
      en: `${rule.sustainedMin} min sustained`,
    });
  }
  const red = rule.level === 'red';
  return {
    es: `${fmt(value)} ${ind.unit} está fuera de la referencia (${ref}); en vigilancia: pasa a ${red ? 'rojo' : 'ámbar'} con ${req.map((r) => r.es).join(' o ')}.`,
    en: `${fmt(value)} ${ind.unit} is outside the reference (${ref}); being watched: it turns ${red ? 'red' : 'amber'} after ${req.map((r) => r.en).join(' or ')}.`,
  };
}

function fmt(v: number | undefined): string {
  if (v === undefined) return '—';
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}
