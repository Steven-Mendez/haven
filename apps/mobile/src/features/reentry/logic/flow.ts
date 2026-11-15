import type { Reading } from '@haven/core';

export type TestPhase = 'intro' | 'supine' | 'standing' | 'symptoms' | 'result';

export const PULSE_MIN = 30;
export const PULSE_MAX = 220;
/** A watch pulse this recent can fill the field instead of typing it. */
export const WATCH_PULSE_MAX_AGE_MS = 2 * 60_000;

export function parsePulse(text: string): number | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (!/^\d{2,3}(\.\d)?$/.test(trimmed)) return undefined;
  const value = Math.round(Number(trimmed));
  return value >= PULSE_MIN && value <= PULSE_MAX ? value : undefined;
}

export function recentWatchPulse(readings: Reading[], now: Date): number | undefined {
  const limit = now.getTime() - WATCH_PULSE_MAX_AGE_MS;
  const last = readings
    .filter(
      (r) =>
        r.indicator === 'heart-rate' &&
        r.source === 'watch' &&
        typeof r.value === 'number' &&
        Date.parse(r.takenAt) >= limit &&
        Date.parse(r.takenAt) <= now.getTime(),
    )
    .sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt))
    .at(-1);
  return typeof last?.value === 'number' ? Math.round(last.value) : undefined;
}

export function nextPhase(phase: TestPhase): TestPhase {
  const order: TestPhase[] = ['intro', 'supine', 'standing', 'symptoms', 'result'];
  return order[Math.min(order.indexOf(phase) + 1, order.length - 1)] ?? 'result';
}
