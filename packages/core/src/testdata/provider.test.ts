import { describe, expect, it } from 'vitest';
import type { Reading, Scenario, WatchEnvelope } from '../contracts';
import { createSimulator, type Timers } from './provider';

/** Fake timers: `run()` fires pending callbacks in order without waiting. */
function fakeTimers() {
  let queue: { fn: () => void; ms: number; id: number }[] = [];
  let next = 0;
  const timers: Timers = {
    setTimeout: (fn, ms) => {
      next++;
      queue.push({ fn, ms, id: next });
      return next;
    },
    clearTimeout: (h) => {
      queue = queue.filter((q) => q.id !== h);
    },
  };
  const delays: number[] = [];
  const run = (max = 10_000) => {
    for (let i = 0; i < max && queue.length > 0; i++) {
      const q = queue.shift();
      if (!q) break;
      delays.push(q.ms);
      q.fn();
    }
  };
  return { timers, run, delays, pending: () => queue.length };
}

const t = { es: 'x', en: 'x' };
const scenario: Scenario = {
  id: 'test',
  name: t,
  durationMin: 3,
  sources: [],
  series: [
    {
      indicator: 'heart-rate',
      points: [
        [0, 80],
        [1, 120],
        [3, 150],
      ],
    },
  ],
  events: [
    { minute: 2, message: 'emergency', payload: { origin: 'fall', takenAt: '' } },
    { minute: 2, message: 'monitor', payload: { heartRate: 150, takenAt: '', spo2: 92 } },
  ],
  expected: [],
};
const start = new Date('2026-11-14T08:00:00.000Z');

describe('createSimulator', () => {
  it('plays a scenario with live subscribe and watch messages, accelerated', async () => {
    const ft = fakeTimers();
    const sim = createSimulator({
      crewMember: 'elena-vega',
      start,
      factor: 60,
      scenarios: [scenario],
      timers: ft.timers,
      clock: () => 0,
      history: false,
    });
    const live: Reading[] = [];
    const watch: WatchEnvelope[] = [];
    sim.subscribe('heart-rate', (r) => live.push(r));
    sim.onWatchMessage((e) => watch.push(e));
    sim.play('test');
    expect(sim.playback()).toMatchObject({ scenario: 'test', playing: true });
    ft.run();
    expect(live.map((r) => r.value)).toEqual([80, 120, 150]);
    expect(live.every((r) => !r.simulated && r.source === 'watch')).toBe(true);
    expect(live[1]?.takenAt).toBe('2026-11-14T08:01:00.000Z');
    expect(ft.delays).toContain(1000); // 1 simulated minute at factor 60
    expect(watch.map((e) => e.type)).toEqual(['emergency', 'monitor']);
    expect(watch[0]).toMatchObject({
      simulated: false,
      crewMember: 'elena-vega',
      payload: { origin: 'fall', takenAt: '2026-11-14T08:02:00.000Z' },
    });
    expect(watch[1]?.payload).toMatchObject({ spo2TakenAt: '2026-11-14T08:02:00.000Z' });
    expect(sim.playback().playing).toBe(false);
    expect(sim.now().toISOString()).toBe('2026-11-14T08:03:00.000Z');
    const read = await sim.read('heart-rate', '2026-11-14T08:00:30.000Z');
    expect(read.map((r) => r.value)).toEqual([120, 150]);
  });

  it('stop() cancels pending emissions', () => {
    const ft = fakeTimers();
    const sim = createSimulator({
      crewMember: 'elena-vega',
      start,
      scenarios: [scenario],
      timers: ft.timers,
      clock: () => 0,
      history: false,
    });
    const live: Reading[] = [];
    sim.subscribe('*', (r) => live.push(r));
    sim.play('test');
    sim.stop();
    ft.run();
    expect(live).toEqual([]);
    expect(ft.pending()).toBe(0);
  });

  it('pressEmergency, sendToWatch and lastWatchStatus (watch simulator)', () => {
    const sim = createSimulator({
      crewMember: 'samira-chen',
      start,
      scenarios: [],
      history: false,
    });
    const watch: WatchEnvelope[] = [];
    const off = sim.onWatchMessage((e) => watch.push(e));
    sim.pressEmergency();
    expect(watch[0]).toMatchObject({
      type: 'emergency',
      simulated: false,
      payload: { origin: 'button' },
    });
    off();
    sim.pressEmergency();
    expect(watch).toHaveLength(1);
    const status: WatchEnvelope<'status'> = {
      v: 1,
      type: 'status',
      crewMember: 'samira-chen',
      simulated: false,
      sentAt: start.toISOString(),
      payload: { overallLevel: 'amber', evaluatedAt: start.toISOString() },
    };
    sim.sendToWatch(status);
    expect(sim.lastWatchStatus()).toEqual(status);
    expect(sim.watchInbox()).toHaveLength(1);
  });

  it('read() serves 30 days of demo history by default', async () => {
    const sim = createSimulator({ crewMember: 'mateo-rios', start, scenarios: [] });
    const sleep = await sim.read(
      'sleep',
      new Date(start.getTime() - 40 * 86_400_000).toISOString(),
    );
    expect(sleep.length).toBeGreaterThanOrEqual(29);
    expect(await sim.isAvailable()).toBe(true);
  });

  it('unknown scenario throws', () => {
    const sim = createSimulator({ crewMember: 'x', scenarios: [], history: false });
    expect(() => sim.play('nope')).toThrow('Unknown scenario');
  });
});
