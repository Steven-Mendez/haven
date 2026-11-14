// Pre-flight baseline (M05 profile). Pure: only `@haven/core` and relative modules.
//
// Limitation: `computeBaseline` (core) has no pre-flight input and the shared store evaluates with the
// in-flight baseline only, so the pre-flight value does not change levels. It is stored per crew
// member and shown next to the in-flight baseline (drift since launch).

/** Numeric indicators with a meaningful pre-flight reference (ids from GLOSSARY.md). */
export const PREFLIGHT_INDICATORS = [
  'heart-rate',
  'hrv',
  'systolic-bp',
  'diastolic-bp',
  'spo2',
  'weight',
  'reaction-time',
  'sleep',
] as const;

/** One crew member's pre-flight values, by indicator id. */
export type PreflightBaseline = {
  crewMember: string;
  values: Record<string, number>;
  updatedAt: string;
};

/** Parses a number typed by the user (accepts a decimal comma). `undefined` if empty or invalid. */
export function parseMeasure(text: string): number | undefined {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
}

/** Whether a pre-flight value is plausible: inside 0.25×–4× the green range bounds of the indicator. */
export function isPlausible(value: number, green: [number, number]): boolean {
  const [low, high] = green;
  return value >= Math.min(0, low * 0.25) && value <= Math.max(high * 4, high + 1);
}

/**
 * Change of the in-flight median against the pre-flight value, in percent (one decimal).
 * `undefined` when either is missing or the pre-flight value is 0.
 */
export function driftPercent(preflight: number | undefined, inFlightMedian: number | undefined) {
  if (preflight === undefined || inFlightMedian === undefined || preflight === 0) return undefined;
  return Math.round(((inFlightMedian - preflight) / Math.abs(preflight)) * 1000) / 10;
}

/** Merges edited values into a stored baseline; empty / invalid text removes the value. */
export function mergePreflight(
  current: PreflightBaseline | undefined,
  crewMember: string,
  edits: Record<string, string>,
  now: Date,
): PreflightBaseline {
  const values = { ...(current?.values ?? {}) };
  for (const [indicator, text] of Object.entries(edits)) {
    const value = parseMeasure(text);
    if (value === undefined) delete values[indicator];
    else values[indicator] = value;
  }
  return { crewMember, values, updatedAt: now.toISOString() };
}
