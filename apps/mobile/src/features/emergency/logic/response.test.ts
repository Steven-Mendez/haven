import { describe, expect, it } from 'vitest';
import { ASK_AFTER_MS, responseOf, secondsLeft, UNRESPONSIVE_AFTER_ASK_MS } from './response';

describe('responseOf', () => {
  it('stays responding until the ask threshold', () => {
    expect(responseOf(0, 0)).toBe('responding');
    expect(responseOf(0, ASK_AFTER_MS - 1)).toBe('responding');
  });

  it('asks first and only then marks the astronaut unresponsive', () => {
    expect(responseOf(0, ASK_AFTER_MS)).toBe('asking');
    expect(responseOf(0, ASK_AFTER_MS + UNRESPONSIVE_AFTER_ASK_MS - 1)).toBe('asking');
    expect(responseOf(0, ASK_AFTER_MS + UNRESPONSIVE_AFTER_ASK_MS)).toBe('unresponsive');
  });

  it('a touch restarts the wait', () => {
    const later = ASK_AFTER_MS + UNRESPONSIVE_AFTER_ASK_MS + 5_000;
    expect(responseOf(later - 1_000, later)).toBe('responding');
  });

  it('a timed step extends the wait by its duration', () => {
    expect(responseOf(0, ASK_AFTER_MS + 60_000, 120)).toBe('responding');
    expect(responseOf(0, ASK_AFTER_MS + 120_000, 120)).toBe('asking');
  });
});

describe('secondsLeft', () => {
  it('counts down to the unresponsive mark and never goes negative', () => {
    expect(secondsLeft(0, ASK_AFTER_MS)).toBe(UNRESPONSIVE_AFTER_ASK_MS / 1000);
    expect(secondsLeft(0, ASK_AFTER_MS + UNRESPONSIVE_AFTER_ASK_MS + 9_000)).toBe(0);
  });
});
