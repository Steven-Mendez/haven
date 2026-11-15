import type { EditableIndicator, Range } from './rules';

/** Unidades que son una escala corta de enteros: se eligen tocando, no escribiendo. */
const DISCRETE: Record<string, Range> = {
  'points (1–5)': [1, 5],
  level: [1, 5],
};

const DECIMAL_UNITS = new Set(['°C', 'Δ°C', '%', 'kPa', 'mSv/day', 'mSv', 'h', 'km']);
const COARSE_UNITS: Record<string, number> = { steps: 100, mL: 50, kcal: 50 };

export type RangeControl =
  | { kind: 'discrete'; options: number[] }
  | { kind: 'continuous'; step: number; decimals: number; nonNegative: boolean; percent: boolean };

const snap = (v: number, step: number, dir: 'down' | 'up') =>
  (dir === 'down' ? Math.floor(v / step) : Math.ceil(v / step)) * step;

/** Escoge el control según la unidad: botones para escalas cortas, deslizador para el resto. */
export function rangeControlFor(indicator: EditableIndicator): RangeControl {
  const discrete = DISCRETE[indicator.unit];
  if (discrete) {
    const options: number[] = [];
    for (let v = discrete[0]; v <= discrete[1]; v++) options.push(v);
    return { kind: 'discrete', options };
  }
  const step =
    COARSE_UNITS[indicator.unit] ??
    (DECIMAL_UNITS.has(indicator.unit) || [...indicator.green].some((v) => !Number.isInteger(v))
      ? 0.1
      : 1);
  const all = [...indicator.green, ...indicator.rules.flatMap((r) => r.outside)];
  return {
    kind: 'continuous',
    step,
    decimals: step < 1 ? 1 : 0,
    nonNegative: Math.min(...all) >= 0,
    percent: indicator.unit === '%',
  };
}

/**
 * Recorrido del deslizador para un rango concreto: se centra en ese rango y deja holgura
 * a cada lado, para que un umbral lejano (p. ej. 25 frente a 0–1) no aplaste los demás.
 */
export function sliderDomain(
  [lo, hi]: Range,
  control: Extract<RangeControl, { kind: 'continuous' }>,
): Range {
  const { step } = control;
  const pad = Math.max((hi - lo) * 0.6, step * 10);
  let min = snap(lo - pad, step, 'down');
  let max = snap(hi + pad, step, 'up');
  if (control.nonNegative) min = Math.max(0, min);
  if (control.percent) max = Math.min(100, max);
  return [min, max];
}
