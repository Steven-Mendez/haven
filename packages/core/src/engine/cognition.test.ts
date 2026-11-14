import { describe, expect, it } from 'vitest';
import type { Reading } from '../contracts';
import { cognitiveVerdict } from './cognition';
import { NOW, reading, TEST_CONFIG } from './test-fixtures';

/** 10 daily batteries around 280 ms, ending one day before NOW. */
function history(): Reading[] {
  const rs: Reading[] = [];
  for (let d = 10; d >= 1; d--) {
    const m = d * 1440;
    rs.push(reading('reaction-time', 270 + (d % 3) * 10, m));
    rs.push(reading('pvt-lapses', 0, m));
    rs.push(reading('working-memory', 5, m));
  }
  return rs;
}
const battery = (rt: number, minutesAgo: number) => [
  reading('reaction-time', rt, minutesAgo),
  reading('pvt-lapses', 0, minutesAgo),
  reading('working-memory', 5, minutesAgo),
];

describe('cognitiveVerdict', () => {
  it('pending without any battery', () => {
    const v = cognitiveVerdict([], TEST_CONFIG, 'transit', {}, NOW);
    expect(v.level).toBe('pending');
    expect(v.canRetake).toBe(true);
  });

  it('a normal battery is green and not locked', () => {
    const v = cognitiveVerdict([...history(), ...battery(282, 5)], TEST_CONFIG, 'transit', {}, NOW);
    expect(v.level).toBe('green');
    expect(v.consecutiveFailures).toBe(0);
    expect(v.canRetake).toBe(true);
  });

  it('reaction 20 % slower → amber, locked for 2 h, repeat action', () => {
    const v = cognitiveVerdict(
      [...history(), ...battery(340, 30)],
      TEST_CONFIG,
      'transit',
      {},
      NOW,
    );
    expect(v.level).toBe('amber');
    expect(v.consecutiveFailures).toBe(1);
    expect(v.canRetake).toBe(false);
    expect(v.lockedUntil).toBe(new Date(NOW.getTime() + 90 * 60_000).toISOString());
    expect(v.notifyEarth).toBe(false);
    expect(v.actions[0]?.id).toBe('repeat-battery-2h');
  });

  it('the lock expires after 2 h', () => {
    const v = cognitiveVerdict(
      [...history(), ...battery(340, 121)],
      TEST_CONFIG,
      'transit',
      {},
      NOW,
    );
    expect(v.canRetake).toBe(true);
    expect(v.lockedUntil).toBeUndefined();
  });

  it('second failure in a row → notify Earth', () => {
    const v = cognitiveVerdict(
      [...history(), ...battery(345, 180), ...battery(350, 5)],
      TEST_CONFIG,
      'transit',
      {},
      NOW,
    );
    expect(v.consecutiveFailures).toBe(2);
    expect(v.notifyEarth).toBe(true);
    expect(v.actions.map((a) => a.id)).toContain('notify-earth');
  });
});
