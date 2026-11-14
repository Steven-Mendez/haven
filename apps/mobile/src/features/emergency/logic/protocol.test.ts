import { loadConfig, type Protocol, protocolSteps } from '@haven/core';
import { describe, expect, it } from 'vitest';
import {
  advance,
  canGoBack,
  currentStep,
  decisionLog,
  goBack,
  hasOptions,
  jumpTo,
  PACKET_STEP_ID,
  type ProtocolRun,
  path,
  progress,
  remainingSteps,
  startRun,
  stepPhase,
} from './protocol';

const chestPain = loadConfig().protocols.find((p) => p.id === 'chest-pain') as Protocol;
const t0 = new Date('2026-11-01T10:00:00Z');
const at = (s: number) => new Date(t0.getTime() + s * 1000);

/** Walks the run choosing an option by step id (default: "done"). */
function walk(env: string, choices: Record<string, number>, max = 60): ProtocolRun {
  let run = startRun(chestPain, env, t0);
  for (let i = 1; i <= max && !run.finishedAt; i++) {
    const step = currentStep(chestPain, run);
    if (!step) break;
    const option = hasOptions(step) ? (choices[step.id] ?? 0) : undefined;
    run = advance(chestPain, run, at(i), option);
  }
  return run;
}

// "No response → not breathing → CPR → AED shock → signs of life → stable".
const CPR_BRANCH = {
  'check-response': 1,
  'check-breathing': 1,
  'aed-analyze': 0,
  'signs-of-life': 0,
  'patient-status': 0,
};
// "Responds → measurements → symptoms → stable".
const RESPONSIVE_BRANCH = { 'check-response': 0, 'patient-status': 0 };

describe('chest-pain protocol in transit', () => {
  it('has 22 steps and filters surface variants', () => {
    expect(chestPain.steps).toHaveLength(22);
    const ids = protocolSteps(chestPain, 'transit').map((s) => s.id);
    expect(ids).toContain('cpr-restraint-micro');
    expect(ids).not.toContain('cpr-position-surface');
  });

  it('CPR branch reaches the packet and the follow-up', () => {
    const run = walk('transit', CPR_BRANCH);
    expect(run.finishedAt).toBeDefined();
    expect(path(run)).toEqual([
      'call-for-help',
      'check-response',
      'check-breathing',
      'cpr-restraint-micro',
      'cpr-compressions',
      'aed-pads',
      'aed-analyze',
      'aed-shock',
      'cpr-after-shock',
      'signs-of-life',
      'measure-vitals',
      'record-ecg',
      'symptom-check',
      'medication-plan',
      'patient-status',
      'guided-ultrasound',
      PACKET_STEP_ID,
      'follow-up',
    ]);
  });

  it('responsive branch secures the patient for microgravity', () => {
    const run = walk('transit', RESPONSIVE_BRANCH);
    expect(path(run).slice(0, 4)).toEqual([
      'call-for-help',
      'check-response',
      'secure-patient-micro',
      'measure-vitals',
    ]);
    expect(path(run)).toContain(PACKET_STEP_ID);
    expect(path(run).at(-1)).toBe('follow-up');
  });

  it('no shock advised and no signs of life loop back to the AED analysis', () => {
    let run = walk('transit', { 'check-response': 1, 'check-breathing': 1, 'aed-analyze': 1 }, 7);
    expect(currentStep(chestPain, run)?.id).toBe('cpr-after-shock');
    expect(path(run)).not.toContain('aed-shock');
    run = advance(chestPain, run, at(20)); // cpr-after-shock → signs-of-life
    run = advance(chestPain, run, at(21), 1); // no signs of life
    expect(currentStep(chestPain, run)?.id).toBe('aed-analyze');
  });
});

describe('chest-pain protocol on Mars', () => {
  it('CPR branch uses the surface position', () => {
    const run = walk('mars', CPR_BRANCH);
    expect(path(run)).toContain('cpr-position-surface');
    expect(path(run)).not.toContain('cpr-restraint-micro');
    expect(path(run)).toContain(PACKET_STEP_ID);
    expect(path(run).at(-1)).toBe('follow-up');
  });

  it('responsive branch sits the patient half upright', () => {
    const run = walk('mars', RESPONSIVE_BRANCH);
    expect(path(run).slice(0, 4)).toEqual([
      'call-for-help',
      'check-response',
      'position-patient-surface',
      'measure-vitals',
    ]);
    expect(path(run)).not.toContain('secure-patient-micro');
    expect(run.finishedAt).toBeDefined();
  });
});

describe('state machine', () => {
  it('does not leave an option step without a valid option', () => {
    let run = startRun(chestPain, 'transit', t0);
    run = advance(chestPain, run, at(1));
    expect(currentStep(chestPain, run)?.id).toBe('check-response');
    expect(advance(chestPain, run, at(2))).toBe(run);
    expect(advance(chestPain, run, at(2), 7)).toBe(run);
  });

  it('goes back and forward, also from a finished run', () => {
    let run = startRun(chestPain, 'transit', t0);
    expect(canGoBack(run)).toBe(false);
    expect(goBack(run, at(1))).toBe(run);
    run = advance(chestPain, run, at(1));
    run = advance(chestPain, run, at(2), 1);
    expect(currentStep(chestPain, run)?.id).toBe('check-breathing');
    run = goBack(run, at(3));
    expect(currentStep(chestPain, run)?.id).toBe('check-response');
    expect(run.visits.at(-1)?.option).toBeUndefined();

    const done = walk('transit', RESPONSIVE_BRANCH);
    const reopened = goBack(done, at(99));
    expect(reopened.finishedAt).toBeUndefined();
    expect(currentStep(chestPain, reopened)?.id).toBe('follow-up');
  });

  it('skips auto steps and opens on the first question', () => {
    const run = startRun(chestPain, 'mars', t0, ['call-for-help']);
    expect(currentStep(chestPain, run)?.id).toBe('check-response');
    expect(run.skipped).toEqual(['call-for-help']);
    expect(canGoBack(run)).toBe(false);
    expect(progress(chestPain, run)).toMatchObject({ index: 1, total: 10 });
    expect(decisionLog(chestPain, run, 'en')[0]).toBe(
      '10:00:00 · Alert the crew. Have someone bring the medical kit and the defibrillator (AED). ✓',
    );
    // An auto step with options is never skipped.
    expect(currentStep(chestPain, startRun(chestPain, 'mars', t0, ['check-response']))?.id).toBe(
      'call-for-help',
    );
  });

  it('jumps to the packet step', () => {
    const run = jumpTo(chestPain, startRun(chestPain, 'transit', t0), PACKET_STEP_ID, at(5));
    expect(currentStep(chestPain, run)?.id).toBe(PACKET_STEP_ID);
    expect(jumpTo(chestPain, run, 'nope', at(6))).toBe(run);
  });

  it('progress is a consistent minimum and reaches 1 at the end', () => {
    const run = startRun(chestPain, 'transit', t0);
    const p = progress(chestPain, run);
    expect(p.index).toBe(1);
    // call-for-help → check-response → secure → measure → ecg → symptoms → meds → status → us → packet → follow-up
    expect(p.total).toBe(11);
    expect(remainingSteps(chestPain, 'follow-up', 'transit')).toBe(1);
    expect(progress(chestPain, walk('transit', CPR_BRANCH)).fraction).toBe(1);
  });

  it('labels phases and logs decisions with config texts', () => {
    const byId = (id: string) => chestPain.steps.find((s) => s.id === id);
    expect(stepPhase(byId('cpr-compressions') as never)).toBe('cpr');
    expect(stepPhase(byId('aed-analyze') as never)).toBe('aed');
    expect(stepPhase(byId('check-response') as never)).toBe('triage');
    expect(stepPhase(byId('measure-vitals') as never)).toBe('care');

    const run = walk('transit', CPR_BRANCH, 3);
    const log = decisionLog(chestPain, run, 'es');
    expect(log[1]).toContain('→ No responde');
    expect(log[1].startsWith('10:00:01')).toBe(true);
    expect(decisionLog(chestPain, run, 'en')[2]).toContain('→ Not breathing or only gasping');
  });
});
