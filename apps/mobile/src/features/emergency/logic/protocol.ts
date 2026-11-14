// Pure state machine for a guided protocol (M06). Imports only @haven/core.
// The screen owns time and side effects; every function here takes `now` explicitly.

import { firstStep, nextStep, type Protocol, type Step } from '@haven/core';

/** One visited step: which step, when it was entered and the option chosen to leave it. */
export type Visit = { stepId: string; enteredAt: string; option?: number };

export type ProtocolRun = {
  protocolId: string;
  environment: string;
  startedAt: string;
  /** Visited steps in order; the last one is the current step unless `finishedAt` is set. */
  visits: Visit[];
  /** Leading steps the app performed by itself (e.g. the crew alert), not shown as screens. */
  skipped?: string[];
  finishedAt?: string;
};

/** Phase of a step, used for the "STEP 3 OF 9 · CPR" eyebrow. */
export type StepPhase = 'triage' | 'cpr' | 'aed' | 'care';

/**
 * Starts a run at the first step that applies in the environment. Leading steps listed in
 * `autoSteps` (without options) are skipped because the app performs them itself; the emergency
 * then opens straight on the first question (DESIGN_SYSTEM 4.1c).
 */
export function startRun(
  protocol: Protocol,
  environment: string,
  now: Date,
  autoSteps: readonly string[] = [],
): ProtocolRun {
  let first = firstStep(protocol, environment);
  const skipped: string[] = [];
  while (first && autoSteps.includes(first.id) && !hasOptions(first)) {
    const next = nextStep(protocol, first.id, undefined, environment);
    if (!next) break;
    skipped.push(first.id);
    first = next;
  }
  const at = now.toISOString();
  return {
    protocolId: protocol.id,
    environment,
    startedAt: at,
    visits: first ? [{ stepId: first.id, enteredAt: at }] : [],
    skipped: skipped.length > 0 ? skipped : undefined,
    finishedAt: first ? undefined : at,
  };
}

export function stepById(protocol: Protocol, id: string | undefined): Step | undefined {
  return id ? protocol.steps.find((s) => s.id === id) : undefined;
}

/** Current step, or undefined when the run is finished. */
export function currentStep(protocol: Protocol, run: ProtocolRun): Step | undefined {
  if (run.finishedAt) return undefined;
  return stepById(protocol, run.visits[run.visits.length - 1]?.stepId);
}

export function hasOptions(step: Step | undefined): boolean {
  return !!step?.options && step.options.length > 0;
}

/**
 * Leaves the current step. Steps with options need `option` (index); without it the run does not
 * change. Without a next step the run finishes.
 */
export function advance(
  protocol: Protocol,
  run: ProtocolRun,
  now: Date,
  option?: number,
): ProtocolRun {
  const step = currentStep(protocol, run);
  if (!step) return run;
  if (hasOptions(step) && (option === undefined || !step.options?.[option])) return run;
  const at = now.toISOString();
  const visits = run.visits.slice();
  const last = visits.length - 1;
  visits[last] = { ...visits[last], option: hasOptions(step) ? option : undefined };
  const next = nextStep(protocol, step.id, option, run.environment);
  if (!next) return { ...run, visits, finishedAt: at };
  visits.push({ stepId: next.id, enteredAt: at });
  return { ...run, visits };
}

/** Goes back one step (or reopens the last step of a finished run). */
export function goBack(run: ProtocolRun, now: Date): ProtocolRun {
  const at = now.toISOString();
  if (run.finishedAt) {
    const visits = run.visits.slice();
    const last = visits.length - 1;
    if (last >= 0) visits[last] = { stepId: visits[last].stepId, enteredAt: at };
    return { ...run, visits, finishedAt: undefined };
  }
  if (run.visits.length <= 1) return run;
  const visits = run.visits.slice(0, -1);
  const last = visits.length - 1;
  visits[last] = { stepId: visits[last].stepId, enteredAt: at };
  return { ...run, visits };
}

export function canGoBack(run: ProtocolRun): boolean {
  return !!run.finishedAt || run.visits.length > 1;
}

/** Jumps forward to a step id (e.g. "packet" from anywhere), recording it as visited. */
export function jumpTo(
  protocol: Protocol,
  run: ProtocolRun,
  stepId: string,
  now: Date,
): ProtocolRun {
  if (!stepById(protocol, stepId)) return run;
  const at = now.toISOString();
  return { ...run, finishedAt: undefined, visits: [...run.visits, { stepId, enteredAt: at }] };
}

/**
 * Shortest number of steps from `stepId` (included) to the end of the protocol, following `next`
 * and every option, skipping steps that do not apply in the environment.
 */
export function remainingSteps(protocol: Protocol, stepId: string, environment: string): number {
  const dist = new Map<string, number>([[stepId, 1]]);
  const queue = [stepId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const step = stepById(protocol, id);
    const d = dist.get(id) ?? 1;
    if (!step) return d;
    const branches = hasOptions(step)
      ? (step.options ?? []).map((_, i) => nextStep(protocol, id, i, environment))
      : [nextStep(protocol, id, undefined, environment)];
    if (branches.every((b) => !b)) return d;
    for (const b of branches) {
      if (b && !dist.has(b.id)) {
        dist.set(b.id, d + 1);
        queue.push(b.id);
      }
    }
  }
  return 1;
}

/** "Step n of N": n = visited steps; N = n − 1 + shortest remaining path (an honest minimum). */
export function progress(
  protocol: Protocol,
  run: ProtocolRun,
): { index: number; total: number; fraction: number } {
  const index = Math.max(1, run.visits.length);
  const step = currentStep(protocol, run);
  if (!step) return { index, total: index, fraction: 1 };
  const total = index - 1 + remainingSteps(protocol, step.id, run.environment);
  return { index, total, fraction: total > 0 ? index / total : 1 };
}

export function stepPhase(step: Step): StepPhase {
  if (step.id.startsWith('cpr-')) return 'cpr';
  if (step.id.startsWith('aed-')) return 'aed';
  if (hasOptions(step)) return 'triage';
  return 'care';
}

/** Step id that prepares the packet to Earth (config `chest-pain`, `fever`). */
export const PACKET_STEP_ID = 'earth-packet';
/** Step ids whose screen offers the quick entry of pressure, SpO₂ and pulse. */
export const VITALS_STEP_IDS = ['measure-vitals'];
/** Step ids whose screen opens the symptom checklist. */
export const SYMPTOM_STEP_IDS = ['symptom-check', 'check-symptoms'];
/** Steps the app performs itself when the emergency opens (crew alert by `crewHaptic`). */
export const AUTO_STEP_IDS = ['call-for-help'];

/** Step ids of the run, in order (for tests and the decision log). */
export function path(run: ProtocolRun): string[] {
  return run.visits.map((v) => v.stepId);
}

type Lang = 'es' | 'en';

/** Plain-text log of the decisions taken, for `Packet.notes` (config texts, current language). */
export function decisionLog(protocol: Protocol, run: ProtocolRun, language: Lang): string[] {
  const lines: string[] = [];
  for (const id of run.skipped ?? []) {
    const step = stepById(protocol, id);
    if (step) lines.push(`${run.startedAt.slice(11, 19)} · ${step.text[language]} ✓`);
  }
  for (const visit of run.visits) {
    const step = stepById(protocol, visit.stepId);
    if (!step) continue;
    const time = visit.enteredAt.slice(11, 19);
    const choice =
      visit.option !== undefined ? step.options?.[visit.option]?.text[language] : undefined;
    lines.push(`${time} · ${step.text[language]}${choice ? ` → ${choice}` : ''}`);
  }
  return lines;
}
