import type { Reading } from '@haven/core';

export type Random = () => number;

export const BATTERY_TIMEOUT_MS = 225_000;

export function isTimedOut(startedAt: number, now: number): boolean {
  return now - startedAt >= BATTERY_TIMEOUT_MS;
}

export function interruptsBattery(appState: string): boolean {
  return appState === 'background' || appState === 'inactive';
}

export const PVT_TRIALS = 5;
export const PVT_MIN_DELAY_MS = 1_500;
export const PVT_MAX_DELAY_MS = 5_000;
export const PVT_LAPSE_MS = 500;
export const PVT_NO_RESPONSE_MS = 3_000;

export function pvtDelay(random: Random): number {
  return Math.round(PVT_MIN_DELAY_MS + random() * (PVT_MAX_DELAY_MS - PVT_MIN_DELAY_MS));
}

export type PvtResult = {
  reactionMs: number;
  lapses: number;
  falseStarts: number;
  trials: number[];
};

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function scorePvt(reactionTimes: number[], falseStarts: number): PvtResult {
  const trials = reactionTimes.map((rt) => Math.min(Math.max(0, rt), PVT_NO_RESPONSE_MS));
  return {
    reactionMs: Math.round(median(trials)),
    lapses: trials.filter((rt) => rt > PVT_LAPSE_MS).length,
    falseStarts,
    trials,
  };
}

export const GRID_SIZE = 4;
export const GRID_CELLS = GRID_SIZE * GRID_SIZE;
export const MEMORY_MIN_LEVEL = 3;
export const MEMORY_MAX_LEVEL = 5;
export const MEMORY_TRIALS = 5;
export const MEMORY_NONE = MEMORY_MIN_LEVEL - 1;

export function memoryShowMs(level: number): number {
  return 1_000 + 400 * level;
}

export function memoryPattern(level: number, random: Random): number[] {
  const cells = Array.from({ length: GRID_CELLS }, (_, i) => i);
  for (let i = 0; i < level; i++) {
    const j = i + Math.floor(random() * (GRID_CELLS - i));
    [cells[i], cells[j]] = [cells[j] as number, cells[i] as number];
  }
  return cells.slice(0, level).sort((a, b) => a - b);
}

export function isRecallCorrect(pattern: number[], taps: number[]): boolean {
  const set = new Set(taps);
  return set.size === pattern.length && pattern.every((c) => set.has(c));
}

export function nextMemoryLevel(level: number, correct: boolean): number {
  const next = correct ? level + 1 : level - 1;
  return Math.min(MEMORY_MAX_LEVEL, Math.max(MEMORY_MIN_LEVEL, next));
}

export type MemoryTrial = { level: number; correct: boolean };

export function scoreMemory(trials: MemoryTrial[]): number {
  return trials.reduce((best, t) => (t.correct && t.level > best ? t.level : best), MEMORY_NONE);
}

export const GO_NOGO_DURATION_MS = 20_000;
export const GO_NOGO_STIMULUS_MS = 700;
export const GO_NOGO_GAP_MS = 500;
export const GO_NOGO_SLOT_MS = GO_NOGO_STIMULUS_MS + GO_NOGO_GAP_MS;
export const GO_RATIO = 0.75;

export type Stimulus = { kind: 'go' | 'nogo'; at: number };

export function goNoGoSequence(random: Random, durationMs = GO_NOGO_DURATION_MS): Stimulus[] {
  const count = Math.floor(durationMs / GO_NOGO_SLOT_MS);
  const list: Stimulus[] = Array.from({ length: count }, (_, i) => ({
    kind: random() < GO_RATIO ? 'go' : 'nogo',
    at: i * GO_NOGO_SLOT_MS,
  }));
  if (count >= 2) {
    if (!list.some((s) => s.kind === 'nogo')) (list[count - 1] as Stimulus).kind = 'nogo';
    if (!list.some((s) => s.kind === 'go')) (list[0] as Stimulus).kind = 'go';
  }
  return list;
}

export function scoreGoNoGo(stimuli: Stimulus[], tapped: boolean[]): number {
  if (stimuli.length === 0) return 0;
  const correct = stimuli.filter((s, i) => (s.kind === 'go') === Boolean(tapped[i])).length;
  return Math.round((correct / stimuli.length) * 100);
}

export type BatteryResult = { pvt: PvtResult; memory: number; goNoGo: number };

export function falseStartsNote(n: number): string {
  return `false-starts:${n}`;
}

export function batteryReadings(
  result: BatteryResult,
  options: {
    crewMember: string;
    takenAt: string;
    newId: () => string;
    unitOf: (indicator: string) => string;
  },
): Reading[] {
  const base = { source: 'screen' as const, simulated: false, crewMember: options.crewMember };
  const make = (indicator: string, value: number, note?: string): Reading => ({
    id: options.newId(),
    indicator,
    value,
    unit: options.unitOf(indicator),
    takenAt: options.takenAt,
    ...base,
    ...(note ? { note } : {}),
  });
  return [
    make('reaction-time', result.pvt.reactionMs, falseStartsNote(result.pvt.falseStarts)),
    make('pvt-lapses', result.pvt.lapses),
    make('working-memory', result.memory),
    make('go-nogo-accuracy', result.goNoGo),
  ];
}

export function minutesUntil(lockedUntil: string | undefined, now: number): number {
  if (!lockedUntil) return 0;
  return Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - now) / 60_000));
}
