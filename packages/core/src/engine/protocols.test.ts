import { describe, expect, it } from 'vitest';
import type { Protocol } from '../contracts';
import { firstStep, nextStep, protocolSteps } from './protocols';

const t = { es: '', en: '' };
const protocol: Protocol = {
  id: 'chest-pain',
  name: t,
  start: 'restrain',
  steps: [
    { id: 'restrain', text: t, onlyIn: ['transit', 'station'], next: 'ask' },
    {
      id: 'ask',
      text: t,
      options: [
        { text: t, next: 'aed' },
        { text: t, next: 'monitor' },
      ],
    },
    { id: 'aed', text: t, next: 'lie-down' },
    { id: 'lie-down', text: t, onlyIn: ['moon', 'mars'], next: 'monitor' },
    { id: 'monitor', text: t },
  ],
};

describe('protocols', () => {
  it('protocolSteps filters onlyIn', () => {
    expect(protocolSteps(protocol, 'transit').map((s) => s.id)).toEqual([
      'restrain',
      'ask',
      'aed',
      'monitor',
    ]);
    expect(protocolSteps(protocol, 'mars').map((s) => s.id)).toContain('lie-down');
  });

  it('firstStep skips steps that do not apply', () => {
    expect(firstStep(protocol, 'transit')?.id).toBe('restrain');
    expect(firstStep(protocol, 'mars')?.id).toBe('ask');
  });

  it('nextStep follows next and options, and skips by environment', () => {
    expect(nextStep(protocol, 'restrain')?.id).toBe('ask');
    expect(nextStep(protocol, 'ask')).toBeUndefined();
    expect(nextStep(protocol, 'ask', 1)?.id).toBe('monitor');
    expect(nextStep(protocol, 'aed', undefined, 'transit')?.id).toBe('monitor');
    expect(nextStep(protocol, 'aed', undefined, 'mars')?.id).toBe('lie-down');
    expect(nextStep(protocol, 'monitor')).toBeUndefined();
    expect(nextStep(protocol, 'nope')).toBeUndefined();
  });
});
