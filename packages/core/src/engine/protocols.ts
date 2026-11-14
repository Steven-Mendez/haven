import type { Protocol, Step } from '../contracts';

function applies(step: Step, environment?: string): boolean {
  return (
    !environment || !step.onlyIn || step.onlyIn.length === 0 || step.onlyIn.includes(environment)
  );
}

export function protocolSteps(protocol: Protocol, environment: string): Step[] {
  return protocol.steps.filter((s) => applies(s, environment));
}

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

export function firstStep(protocol: Protocol, environment?: string): Step | undefined {
  return resolve(protocol, protocol.start, environment);
}

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
