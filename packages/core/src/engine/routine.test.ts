import { describe, expect, it } from 'vitest';
import {
  actionsDone,
  dailyProgress,
  dayHistory,
  isDayComplete,
  streak,
  weekCount,
} from './routine';
import { NOW, reading, TEST_CONFIG } from './test-fixtures';

const progressOf = (rs: ReturnType<typeof reading>[]) =>
  Object.fromEntries(dailyProgress(rs, TEST_CONFIG, NOW).map((p) => [p.zone, p.progress]));

describe('dailyProgress', () => {
  it('nothing today: only the shelter action counts (no solar event)', () => {
    const p = progressOf([reading('systolic-bp', 120, 24 * 60)]);
    expect(p).toMatchObject({ heart: 0, lungs: 0, skin: 1, mind: 0 });
  });

  it('indicator, screen fractions, exercise minutes and daily-action marks', () => {
    const p = progressOf([
      reading('systolic-bp', 120, 60),
      reading('mood', 4, 30),
      reading('reaction-time', 280, 20),
      reading('pvt-lapses', 0, 20),
      reading('resistance-exercise', 30, 10),
      reading('daily-action', 'lungs', 5),
    ]);
    expect(p).toMatchObject({
      heart: 1,
      mind: 0.5,
      head: 0.5,
      musculoskeletal: 30 / 45,
      lungs: 1,
    });
  });

  it("opens 'routine' needs the daily-action mark; ship telemetry never completes an action", () => {
    const config = JSON.parse(JSON.stringify(TEST_CONFIG)) as typeof TEST_CONFIG;
    const lungs = config.zones.find((z) => z.id === 'lungs');
    if (!lungs) throw new Error('fixture');
    lungs.dailyAction.opens = 'routine';
    const at = (rs: ReturnType<typeof reading>[]) =>
      dailyProgress(rs, config, NOW).find((p) => p.zone === 'lungs')?.progress;
    expect(at([reading('cabin-co2', 2, 10, { source: 'ship' }), reading('spo2', 98, 5)])).toBe(0);
    expect(at([reading('daily-action', 'lungs', 5)])).toBe(1);
    lungs.dailyAction.opens = 'other-screen';
    expect(at([reading('cabin-co2', 2, 10, { source: 'ship' })])).toBe(0);
    expect(at([reading('spo2', 98, 5)])).toBe(1);
  });

  it('shelter action needs confirmation during a solar event ≥ S2', () => {
    expect(progressOf([reading('solar-event', 2, 30)]).skin).toBe(0);
    expect(progressOf([reading('solar-event', 1, 30)]).skin).toBe(1);
  });
});

describe('ring, day and streak', () => {
  it('a 50 % action does not count', () => {
    const p = [
      { zone: 'a', progress: 1 },
      { zone: 'b', progress: 0.5 },
    ];
    expect(actionsDone(p)).toBe(1);
    expect(isDayComplete(p)).toBe(false);
    expect(isDayComplete(p.map((x) => ({ ...x, progress: 1 })))).toBe(true);
  });

  it('streak counts back from yesterday; an open today never breaks it', () => {
    const days = [
      { date: '2026-11-10', complete: true },
      { date: '2026-11-11', complete: false },
      { date: '2026-11-12', complete: true },
      { date: '2026-11-13', complete: true },
      { date: '2026-11-14', complete: false },
    ];
    expect(streak(days, '2026-11-14')).toBe(2);
    expect(
      streak([...days.slice(0, 4), { date: '2026-11-14', complete: true }], '2026-11-14'),
    ).toBe(3);
    expect(weekCount(days, '2026-11-14')).toBe(3);
  });

  it('dayHistory computes past days at their end', () => {
    const all = TEST_CONFIG.zones.map((z) => reading('daily-action', z.id, 24 * 60));
    const h = dayHistory(all, TEST_CONFIG, NOW, 3);
    expect(h).toEqual([
      { date: '2026-11-12', complete: false },
      { date: '2026-11-13', complete: true },
      { date: '2026-11-14', complete: false },
    ]);
  });
});
