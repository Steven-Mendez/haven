import { describe, expect, it } from 'vitest';
import { loadConfig, motion } from '../config';
import {
  adaptationWindow,
  BALANCE_INDICATOR,
  balanceAvailable,
  balanceReading,
  balanceResult,
  latestBalance,
  latestMotion,
  motionCheckDue,
  motionDays,
  motionLevel,
  motionReading,
  swayMilliG,
} from './motion';

const { environments } = loadConfig();
const NOW = new Date('2026-03-10T15:00:00Z');
let n = 0;
const opts = (takenAt: string) => ({ crewMember: 'ana', takenAt, newId: () => `r${n++}` });
const score = (value: number, takenAt: string) => motionReading(value, opts(takenAt));

const LUNAR = [
  { environment: 'launch', days: 1 },
  { environment: 'transit', days: 3 },
  { environment: 'lunar-orbit', days: 2 },
  { environment: 'moon', days: 10 },
  { environment: 'reentry', days: 1 },
];

describe('motion scale', () => {
  it('is green up to 1, amber from 2 and red from nausea (6)', () => {
    expect([0, 1, 2, 5, 6, 10].map((s) => motionLevel(s, motion))).toEqual([
      'green',
      'green',
      'amber',
      'amber',
      'red',
      'red',
    ]);
    expect(motion.scale.map((s) => s.score)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('reads the latest score and the worst one of each day', () => {
    const readings = [
      score(3, '2026-03-09T08:00:00Z'),
      score(6, '2026-03-09T20:00:00Z'),
      score(2, '2026-03-10T09:00:00Z'),
    ];
    expect(latestMotion(readings, motion)).toEqual({
      score: 2,
      at: '2026-03-10T09:00:00Z',
      level: 'amber',
    });
    expect(motionDays(readings, NOW, 3)).toEqual([
      { day: '2026-03-08', score: null },
      { day: '2026-03-09', score: 6 },
      { day: '2026-03-10', score: 2 },
    ]);
    expect(latestMotion([], motion)).toBeUndefined();
  });
});

describe('adaptation window', () => {
  it('opens in the first days of the mission', () => {
    expect(adaptationWindow({ day: 2, environment: 'transit' }, motion, environments)).toEqual({
      open: true,
      reason: 'launch',
      environment: 'transit',
      day: 2,
      of: 3,
    });
  });

  it('opens when a phase changes gravity, not when it keeps it', () => {
    // Day 7 is the first day on the Moon (launch 1, transit 2–4, orbit 5–6).
    expect(
      adaptationWindow({ day: 8, environment: 'moon', phases: LUNAR }, motion, environments),
    ).toEqual({ open: true, reason: 'transition', environment: 'moon', day: 2, of: 3 });
    expect(
      adaptationWindow({ day: 10, environment: 'moon', phases: LUNAR }, motion, environments),
    ).toEqual({ open: false });
    // Transit to lunar orbit: both without gravity.
    expect(
      adaptationWindow({ day: 5, environment: 'lunar-orbit', phases: LUNAR }, motion, environments),
    ).toEqual({ open: false });
    expect(
      adaptationWindow({ day: 17, environment: 'reentry', phases: LUNAR }, motion, environments),
    ).toMatchObject({ open: true, reason: 'transition', day: 1 });
  });

  it('asks once a day while open', () => {
    const open = adaptationWindow({ day: 1, environment: 'launch' }, motion, environments);
    expect(motionCheckDue([], open, NOW)).toBe(true);
    expect(motionCheckDue([score(0, '2026-03-10T08:00:00Z')], open, NOW)).toBe(false);
    expect(motionCheckDue([score(0, '2026-03-09T08:00:00Z')], open, NOW)).toBe(true);
    expect(motionCheckDue([], { open: false }, NOW)).toBe(false);
  });
});

describe('balance test', () => {
  it('needs surface gravity', () => {
    expect(balanceAvailable('moon', environments)).toBe(true);
    expect(balanceAvailable('mars', environments)).toBe(true);
    expect(balanceAvailable('station', environments)).toBe(false);
    expect(balanceAvailable('reentry', environments)).toBe(false);
  });

  it('measures sway as RMS distance from the mean, in milli-g', () => {
    const still = Array.from({ length: 20 }, () => ({ x: 0, y: 0, z: -1 }));
    expect(swayMilliG(still)).toBe(0);
    const wobble = Array.from({ length: 20 }, (_, i) => ({ x: i % 2 ? 0.02 : -0.02, y: 0, z: -1 }));
    expect(swayMilliG(wobble)).toBe(20);
    expect(swayMilliG(still.slice(0, 5))).toBeUndefined();
  });

  it('flags a large sway with eyes closed or a large jump from eyes open', () => {
    expect(balanceResult({ open: 10, closed: 15 }, motion)).toEqual({
      open: 10,
      closed: 15,
      ratio: 1.5,
      level: 'green',
    });
    expect(balanceResult({ open: 6, closed: 18 }, motion).level).toBe('amber');
    expect(balanceResult({ open: 20, closed: 30 }, motion).level).toBe('amber');
    expect(balanceResult({ open: 30, closed: 50 }, motion).level).toBe('red');
  });

  it('round-trips through its reading', () => {
    const r = balanceReading({ open: 8, closed: 21 }, opts('2026-03-10T10:00:00Z'));
    expect(r.indicator).toBe(BALANCE_INDICATOR);
    expect(latestBalance([r], motion)).toMatchObject({
      open: 8,
      closed: 21,
      ratio: 2.6,
      level: 'amber',
      at: '2026-03-10T10:00:00Z',
    });
  });
});
