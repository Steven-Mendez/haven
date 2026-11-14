import { cognitiveVerdict, computeBaselines, loadConfig, type Reading } from '@haven/core';
import { describe, expect, it } from 'vitest';
import {
  BATTERY_TIMEOUT_MS,
  batteryReadings,
  goNoGoSequence,
  interruptsBattery,
  isRecallCorrect,
  isTimedOut,
  MEMORY_NONE,
  memoryPattern,
  minutesUntil,
  nextMemoryLevel,
  PVT_MAX_DELAY_MS,
  PVT_MIN_DELAY_MS,
  pvtDelay,
  scoreGoNoGo,
  scoreMemory,
  scorePvt,
} from './battery';
import { cognitiveNoticePacket } from './notice';

/** Deterministic PRNG (mulberry32). */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('battery timing', () => {
  it('times out at 225 s', () => {
    expect(isTimedOut(0, BATTERY_TIMEOUT_MS - 1)).toBe(false);
    expect(isTimedOut(0, 225_000)).toBe(true);
  });
  it('background and inactive interrupt; active does not', () => {
    expect(interruptsBattery('background')).toBe(true);
    expect(interruptsBattery('inactive')).toBe(true);
    expect(interruptsBattery('active')).toBe(false);
  });
  it('the whole battery fits in under 4 minutes in the worst case', () => {
    const pvt = 5 * (PVT_MAX_DELAY_MS + 3_000);
    const memory = 5 * (1_000 + 400 * 5 + 10_000);
    const goNoGo = 20_000;
    expect(pvt + memory + goNoGo).toBeLessThan(BATTERY_TIMEOUT_MS);
  });
});

describe('PVT', () => {
  it('signal delay is between 1.5 and 5 s', () => {
    expect(pvtDelay(() => 0)).toBe(PVT_MIN_DELAY_MS);
    expect(pvtDelay(() => 0.999_999)).toBe(PVT_MAX_DELAY_MS);
    const random = seeded(7);
    for (let i = 0; i < 200; i++) {
      const d = pvtDelay(random);
      expect(d).toBeGreaterThanOrEqual(1_500);
      expect(d).toBeLessThanOrEqual(5_000);
    }
  });
  it('lapse only above 500 ms; median reaction; false starts counted', () => {
    const r = scorePvt([250, 500, 501, 300, 9_000], 2);
    expect(r.lapses).toBe(2);
    expect(r.reactionMs).toBe(500);
    expect(r.falseStarts).toBe(2);
    expect(r.trials.at(-1)).toBe(3_000);
  });
});

describe('spatial memory', () => {
  it('pattern has `level` distinct cells inside the 4×4 grid', () => {
    const random = seeded(3);
    for (const level of [3, 4, 5]) {
      const p = memoryPattern(level, random);
      expect(new Set(p).size).toBe(level);
      expect(p.every((c) => c >= 0 && c < 16)).toBe(true);
    }
  });
  it('recall ignores order and requires the exact set', () => {
    expect(isRecallCorrect([1, 5, 9], [9, 1, 5])).toBe(true);
    expect(isRecallCorrect([1, 5, 9], [1, 5, 8])).toBe(false);
    expect(isRecallCorrect([1, 5, 9], [1, 5])).toBe(false);
  });
  it('adapts between 3 and 5 cells', () => {
    expect(nextMemoryLevel(3, false)).toBe(3);
    expect(nextMemoryLevel(3, true)).toBe(4);
    expect(nextMemoryLevel(5, true)).toBe(5);
    expect(nextMemoryLevel(5, false)).toBe(4);
  });
  it('score is the highest level recalled', () => {
    expect(scoreMemory([])).toBe(MEMORY_NONE);
    expect(
      scoreMemory([
        { level: 3, correct: true },
        { level: 4, correct: true },
        { level: 5, correct: false },
        { level: 4, correct: false },
      ]),
    ).toBe(4);
  });
});

describe('Go/No-Go', () => {
  it('fills 20 s with both kinds', () => {
    const s = goNoGoSequence(seeded(11));
    expect(s.length).toBe(16);
    expect(s.some((x) => x.kind === 'go')).toBe(true);
    expect(s.some((x) => x.kind === 'nogo')).toBe(true);
    expect(goNoGoSequence(() => 0).some((x) => x.kind === 'nogo')).toBe(true);
  });
  it('scores taps on circles and withheld squares', () => {
    const s = [
      { kind: 'go' as const, at: 0 },
      { kind: 'nogo' as const, at: 1 },
      { kind: 'go' as const, at: 2 },
      { kind: 'nogo' as const, at: 3 },
    ];
    expect(scoreGoNoGo(s, [true, false, true, false])).toBe(100);
    expect(scoreGoNoGo(s, [true, true, false, false])).toBe(50);
  });
});

describe('readings and verdict', () => {
  const config = loadConfig();
  const unitOf = (id: string) => config.indicators.find((i) => i.id === id)?.unit ?? '';

  /** 10 daily batteries around 270 ms, then today's. */
  function history(now: Date): Reading[] {
    const out: Reading[] = [];
    let n = 0;
    for (let d = 10; d >= 1; d--) {
      const takenAt = new Date(now.getTime() - d * 86_400_000).toISOString();
      const rt = 262 + (d % 4) * 6; // 262..280
      out.push(
        ...batteryReadings(
          { pvt: { reactionMs: rt, lapses: 0, falseStarts: 0, trials: [] }, memory: 5, goNoGo: 96 },
          { crewMember: 'elena-vega', takenAt, newId: () => `h${n++}`, unitOf },
        ),
      );
    }
    return out;
  }

  it('builds four screen readings with config units', () => {
    const list = batteryReadings(
      { pvt: scorePvt([300, 310, 320, 330, 340], 1), memory: 4, goNoGo: 90 },
      { crewMember: 'x', takenAt: '2026-11-01T10:00:00.000Z', newId: () => 'id', unitOf },
    );
    expect(list.map((r) => [r.indicator, r.value, r.unit, r.source])).toEqual([
      ['reaction-time', 320, 'ms', 'screen'],
      ['pvt-lapses', 0, 'lapses', 'screen'],
      ['working-memory', 4, 'level', 'screen'],
      ['go-nogo-accuracy', 90, '%', 'screen'],
    ]);
    expect(list[0]?.note).toBe('false-starts:1');
  });

  it('a reaction 20 % slower than the baseline is amber with "repeat in 2 h" and a 2 h lock', () => {
    const now = new Date('2026-11-01T10:00:00.000Z');
    const past = history(now);
    const base = computeBaselines(past, ['reaction-time']);
    const slow = Math.round((base['reaction-time']?.median ?? 0) * 1.2);
    const today = batteryReadings(
      { pvt: { reactionMs: slow, lapses: 0, falseStarts: 0, trials: [] }, memory: 5, goNoGo: 96 },
      { crewMember: 'elena-vega', takenAt: now.toISOString(), newId: () => 't', unitOf },
    );
    const v = cognitiveVerdict([...past, ...today], config, 'transit', {}, now);
    expect(v.level).toBe('amber');
    expect(v.canRetake).toBe(false);
    expect(minutesUntil(v.lockedUntil, now.getTime())).toBe(120);
    expect(v.actions.map((a) => a.id)).toContain('repeat-battery-2h');
    expect(v.notifyEarth).toBe(false);
  });

  it('notice packet is a routine packet with no artificial delay', () => {
    const p = cognitiveNoticePacket({
      id: 'p1',
      crewMember: 'elena-vega',
      mission: 'ARES01',
      now: new Date('2026-11-01T10:00:00.000Z'),
      assessments: [],
      readings: [],
      notes: 'n',
    });
    expect(p.type).toBe('routine');
    expect(p.visibleAt).toBe('2026-11-01T10:00:00.000Z');
  });
});
