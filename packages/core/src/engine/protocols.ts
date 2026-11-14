import type { Protocol, Step } from '../contracts';

function applies(step: Step, environment?: string): boolean {
  return (
    !environment || !step.onlyIn || step.onlyIn.length === 0 || step.onlyIn.includes(environment)
  );
}

/** Steps that apply in the environment (filters `onlyIn`), in config order. */
export function protocolSteps(protocol: Protocol, environment: string): Step[] {
  return protocol.steps.filter((s) => applies(s, environment));
}

/** Resolves a step id, skipping steps that do not apply in the environment (follows their `next`). */
function resolve(
  protocol: Protocol,
  id: string | undefined,
  environment?: string,
): Step | undefined {
  const seen = new Set<string>();
  let current = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    const step = protocol.steps.find((s) => s.id === current);
    if (!step) return undefined;
    if (applies(step, environment)) return step;
    current = step.next;
  }
  return undefined;
}

/** First step of the protocol (`start`), skipping steps that do not apply in the environment. */
export function firstStep(protocol: Protocol, environment?: string): Step | undefined {
  return resolve(protocol, protocol.start, environment);
}

/**
 * Step after `stepId`. With `options`, one must be chosen (`option` = index); without a choice it
 * returns undefined. Without options, "done" goes to `next`; without `next`, the protocol ends
 * (undefined). With `environment`, steps whose `onlyIn` excludes it are skipped.
 */
export function nextStep(
  protocol: Protocol,
  stepId: string,
  option?: number,
  environment?: string,
): Step | undefined {
  const step = protocol.steps.find((s) => s.id === stepId);
  if (!step) return undefined;
  if (step.options && step.options.length > 0) {
    if (option === undefined) return undefined;
    return resolve(protocol, step.options[option]?.next, environment);
  }
  return resolve(protocol, step.next, environment);
}
