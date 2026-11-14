// Pure chart helpers for SeriesChart: «nice» ticks and per-bucket aggregation (median + range).

/** Up to `max` round tick values covering [lo, hi] (steps of 1, 2, 2.5 or 5 × 10ⁿ). */
export function niceTicks(lo: number, hi: number, max = 3): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi - lo < 1e-9) return [lo];
  const raw = (hi - lo) / Math.max(1, max);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.ceil(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + 1e-9 && ticks.length < max; v += step) {
    ticks.push(Math.round(v / step) * step);
  }
  return ticks;
}

export type Bucket = { t: number; median: number; min: number; max: number; n: number };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * One point per `bucketMs` window (median, with min–max), placed at the bucket's mean time.
 * Keeps a 7-day or 4-week line calm: it never invents values, only summarises them.
 */
export function bucketSeries(points: [number, number][], bucketMs: number): Bucket[] {
  if (!(bucketMs > 0)) return points.map(([t, v]) => ({ t, median: v, min: v, max: v, n: 1 }));
  const groups = new Map<number, [number, number][]>();
  for (const p of points) {
    const key = Math.floor(p[0] / bucketMs);
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, list]) => {
      const vs = list.map(([, v]) => v);
      return {
        t: list.reduce((s, [t]) => s + t, 0) / list.length,
        median: median(vs),
        min: Math.min(...vs),
        max: Math.max(...vs),
        n: list.length,
      };
    });
}

export type FlagLevel = 'amber' | 'red';
export type FlaggedPoint = { t: number; v: number; level: FlagLevel };

/**
 * Safety rule: aggregation must never hide a reading that needs attention. Returns every RAW
 * point whose level is amber/red, or (when the engine gives no level for it) that falls outside
 * the reference range — the personal range is used only when there is no reference range. The
 * dot colour is the reading's level: a reading the engine rates green/pending is never flagged.
 */
export function flaggedPoints(
  raw: [number, number][],
  options: {
    levelAt?: (t: number, v: number) => string | undefined;
    referenceRange?: [number, number];
    personalRange?: [number, number];
  },
): FlaggedPoint[] {
  const out: FlaggedPoint[] = [];
  for (const [t, v] of raw) {
    const given = options.levelAt?.(t, v);
    if (given === 'red' || given === 'amber') {
      out.push({ t, v, level: given });
      continue;
    }
    // The engine says this reading is fine (or still pending): no warning dot.
    if (given !== undefined) continue;
    const range = options.referenceRange ?? options.personalRange;
    if (range && (v < range[0] || v > range[1])) out.push({ t, v, level: 'amber' });
  }
  return out;
}
