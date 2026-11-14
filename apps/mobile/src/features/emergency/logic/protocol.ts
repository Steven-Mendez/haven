import { firstStep, nextStep, type Protocol, type Step } from '@haven/core';

export type Visit = { stepId: string; enteredAt: string; option?: number };

export type ProtocolRun = {
  protocolId: string;
  environment: string;
  startedAt: string;
  visits: Visit[];
  skipped?: string[];
  finishedAt?: string;
};

export type StepPhase = 'triage' | 'cpr' | 'aed' | 'care';

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

export function currentStep(protocol: Protocol, run: ProtocolRun): Step | undefined {
  if (run.finishedAt) return undefined;
  return stepById(protocol, run.visits[run.visits.length - 1]?.stepId);
}

export function hasOptions(step: Step | undefined): boolean {
  return !!step?.options && step.options.length > 0;
}

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

export const PACKET_STEP_ID = 'earth-packet';
export const VITALS_STEP_IDS = ['measure-vitals'];
export const SYMPTOM_STEP_IDS = ['symptom-check', 'check-symptoms'];
export const AUTO_STEP_IDS = ['call-for-help'];

export function path(run: ProtocolRun): string[] {
  return run.visits.map((v) => v.stepId);
}

type Lang = 'es' | 'en';

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
