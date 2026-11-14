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

export type PreflightBaseline = {
  crewMember: string;
  values: Record<string, number>;
  updatedAt: string;
};

export function parseMeasure(text: string): number | undefined {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
}

export function isPlausible(value: number, green: [number, number]): boolean {
  const [low, high] = green;
  return value >= Math.min(0, low * 0.25) && value <= Math.max(high * 4, high + 1);
}

export function driftPercent(preflight: number | undefined, inFlightMedian: number | undefined) {
  if (preflight === undefined || inFlightMedian === undefined || preflight === 0) return undefined;
  return Math.round(((inFlightMedian - preflight) / Math.abs(preflight)) * 1000) / 10;
}

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
