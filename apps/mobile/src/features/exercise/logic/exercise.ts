import type { ExerciseConfig } from '@haven/core';

/** Whole minutes of one session within the configured limits, or undefined. */
export function parseMinutes(text: string, cfg: ExerciseConfig): number | undefined {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  const [min, max] = cfg.limits.sessionMinutes;
  return n >= min && n <= max ? n : undefined;
}
