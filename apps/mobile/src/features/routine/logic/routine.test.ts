import {
  actionsDone,
  dailyProgress,
  dayHistory,
  evaluate,
  isDayComplete,
  loadConfig,
  type Reading,
  streak,
} from '@haven/core';
import { describe, expect, it } from 'vitest';
import {
  actionTarget,
  canMarkDone,
  dailyActionReading,
  dailyItems,
  doneCount,
  dueMeasurements,
  GUIDE_EXAMPLES,
  lastSevenDays,
  nextActions,
  restModuleAtmosphere,
  SKIP_COLLECTION,
  scaleReadings,
  skipId,
  todayCheckin,
} from './routine';

const config = loadConfig();
const zone = (id: string) => {
  const z = config.zones.find((x) => x.id === id);
  if (!z) throw new Error(id);
  return z;
};
let n = 0;
const reading = (
  indicator: string,
  value: number | string,
  takenAt: string,
  extra?: Partial<Reading>,
): Reading => ({
  id: `r${n++}`,
  indicator,
  value,
  unit: '',
  takenAt,
  source: 'manual',
  simulated: false,
  crewMember: 'elena-vega',
  ...extra,
});

describe('action targets', () => {
  it('maps opens to indicator, screen or in-place mark', () => {
    expect(actionTarget(zone('heart'), config)).toEqual({
      kind: 'indicator',
      indicator: 'systolic-bp',
    });
    expect(actionTarget(zone('head'), config)).toEqual({ kind: 'screen', screen: 'cognition' });
    expect(actionTarget(zone('mind'), config)).toEqual({ kind: 'screen', screen: 'wellbeing' });
    expect(actionTarget(zone('lungs'), config)).toEqual({ kind: 'mark' });
  });
  it('only actions without a measurement can be ticked', () => {
    expect(canMarkDone(zone('lungs'), config)).toBe(true);
    expect(canMarkDone(zone('musculoskeletal'), config)).toBe(true);
    expect(canMarkDone(zone('skin'), config)).toBe(true);
    expect(canMarkDone(zone('heart'), config)).toBe(false);
    expect(canMarkDone(zone('head'), config)).toBe(false);
  });
});

describe('daily progress through the engine', () => {
  const now = new Date('2026-11-01T12:00:00.000Z');
  const at = '2026-11-01T09:00:00.000Z';
  const all: Reading[] = [
    reading('systolic-bp', 118, at),
    dailyActionReading('lungs', { id: 'm1', crewMember: 'elena-vega', takenAt: at }),
    ...['reaction-time', 'pvt-lapses', 'working-memory', 'go-nogo-accuracy'].map((i) =>
      reading(i, 1, at),
    ),
    reading('glucose', 90, at),
    dailyActionReading('musculoskeletal', { id: 'm2', crewMember: 'elena-vega', takenAt: at }),
    reading('mood', 4, at),
    reading('stress', 2, at),
  ];

  it('seven actions at 100 % close the day', () => {
    const p = dailyProgress(all, config, now);
    expect(actionsDone(p)).toBe(7);
    expect(isDayComplete(p)).toBe(true);
    const days = dayHistory(all, config, now, 7);
    expect(streak(days, '2026-11-01')).toBe(1);
  });

  it('an action at 50 % does not count', () => {
    const half = all.filter((r) => r.indicator !== 'stress');
    const p = dailyProgress(half, config, now);
    expect(p.find((x) => x.zone === 'mind')?.progress).toBe(0.5);
    expect(actionsDone(p)).toBe(6);
    expect(isDayComplete(p)).toBe(false);
  });

  it('the manual tick never changes a level', () => {
    const without = all.filter((r) => r.indicator !== 'daily-action');
    const a = evaluate(without, config, 'transit', {}, [], now).map((x) => [x.indicator, x.level]);
    const b = evaluate(all, config, 'transit', {}, [], now).map((x) => [x.indicator, x.level]);
    expect(b).toEqual(a);
  });
});

describe('next actions', () => {
  it('max three unfinished, red > amber > pending > green', () => {
    const items = dailyItems(
      config,
      [
        { zone: 'heart', progress: 0 },
        { zone: 'lungs', progress: 1 },
        { zone: 'head', progress: 0 },
        { zone: 'metabolism', progress: 0.5 },
        { zone: 'musculoskeletal', progress: 0 },
        { zone: 'skin', progress: 1 },
        { zone: 'mind', progress: 0 },
      ],
      [
        { zone: 'heart', level: 'green' },
        { zone: 'lungs', level: 'red' },
        { zone: 'head', level: 'amber' },
        { zone: 'metabolism', level: 'pending' },
        { zone: 'musculoskeletal', level: 'green' },
        { zone: 'mind', level: 'red' },
      ],
    );
    expect(nextActions(items).map((i) => i.zone)).toEqual(['mind', 'head', 'metabolism']);
    expect(nextActions(items.map((i) => ({ ...i, progress: 1 })))).toEqual([]);
  });
});

describe('due measurements', () => {
  const now = new Date('2026-11-01T12:00:00.000Z');
  it('lists overdue indicators, groups screens and skips ship telemetry', () => {
    const readings = [
      reading('heart-rate', 70, '2026-11-01T11:00:00.000Z'),
      reading('spo2', 97, '2026-10-31T20:00:00.000Z'),
      reading('reaction-time', 270, '2026-10-30T12:00:00.000Z'),
      reading('mood', 4, '2026-11-01T08:00:00.000Z'),
      reading('cabin-co2', 2, '2026-10-30T08:00:00.000Z', { source: 'ship' }),
    ];
    const due = dueMeasurements(readings, config, now);
    const keys = due.map((d) => d.key);
    expect(keys).not.toContain('heart-rate');
    expect(keys).not.toContain('cabin-co2');
    expect(keys).not.toContain('reaction-time');
    expect(keys).toContain('cognition');
    expect(keys).toContain('spo2');
    expect(keys).toContain('wellbeing');
    const spo2 = due.find((d) => d.key === 'spo2');
    expect(spo2?.overdueMin).toBe(240);
    expect(spo2?.target).toEqual({ kind: 'indicator', indicator: 'spo2' });
    expect(due.find((d) => d.key === 'cognition')?.target).toEqual({
      kind: 'screen',
      screen: 'cognition',
    });
  });
});

describe('week', () => {
  it('keeps the last seven days and flags today', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 9, 23 + i)).toISOString().slice(0, 10),
      complete: i % 2 === 0,
    }));
    const week = lastSevenDays(history, '2026-11-01');
    expect(week).toHaveLength(7);
    expect(week[0]?.date).toBe('2026-10-26');
    expect(week.at(-1)).toEqual({ date: '2026-11-01', complete: false, today: true });
    expect(week.filter((d) => d.today)).toHaveLength(1);
  });
});

describe('rest module atmosphere', () => {
  it('uses only rest-module readings with config thresholds', () => {
    const now = new Date('2026-11-01T12:00:00.000Z');
    const list = [
      reading('cabin-co2', 3.2, '2026-11-01T05:00:00.000Z', {
        source: 'ship',
        note: 'module:rest',
      }),
      reading('cabin-co2', 1.8, '2026-11-01T11:00:00.000Z', { source: 'ship', note: 'module:lab' }),
      reading('cabin-noise', 52, '2026-11-01T05:00:00.000Z', {
        source: 'ship',
        note: 'module:rest',
      }),
    ];
    const a = restModuleAtmosphere(list, config, 'transit', now);
    expect(a.map((x) => [x.indicator, x.value, x.level])).toEqual([
      ['cabin-co2', 3.2, 'amber'],
      ['cabin-noise', 52, 'green'],
    ]);
  });
});

describe('inline check-in and skips', () => {
  const unitOf = (id: string) => config.indicators.find((i) => i.id === id)?.unit ?? '';
  it('builds mood and stress screen readings with no note', () => {
    let k = 0;
    const list = scaleReadings(2, 4, {
      crewMember: 'elena-vega',
      takenAt: '2026-11-01T08:00:00.000Z',
      newId: () => `c${k++}`,
      unitOf,
    });
    expect(list.map((r) => [r.indicator, r.value, r.source, r.note])).toEqual([
      ['mood', 2, 'screen', undefined],
      ['stress', 4, 'screen', undefined],
    ]);
  });
  it('finds today’s check-in only when both values exist', () => {
    const list = [
      reading('mood', 4, '2026-10-31T08:00:00.000Z'),
      reading('stress', 2, '2026-10-31T08:00:00.000Z'),
      reading('mood', 3, '2026-11-01T08:00:00.000Z'),
    ];
    expect(todayCheckin(list, '2026-11-01')).toBeUndefined();
    const both = [...list, reading('stress', 4, '2026-11-01T08:00:01.000Z')];
    expect(todayCheckin(both, '2026-11-01')?.stress.value).toBe(4);
  });
  it('skip ids are per crew member, day and zone; next actions can exclude zones', () => {
    expect(skipId('2026-11-01', 'lungs', 'elena-vega')).toBe('elena-vega:2026-11-01:lungs');
    expect(SKIP_COLLECTION).toMatch(/^[a-z0-9_]+$/);
    const items = dailyItems(config, [], []);
    expect(nextActions(items, 3, ['heart', 'lungs']).map((i) => i.zone)).toEqual([
      'head',
      'metabolism',
      'musculoskeletal',
    ]);
  });
});

describe('guide examples', () => {
  it('six illustrative rings with the n/7 they show', () => {
    expect(GUIDE_EXAMPLES).toHaveLength(6);
    expect(GUIDE_EXAMPLES.map((e) => doneCount(e.segments))).toEqual([0, 2, 7, 6, 2, 7]);
  });
});
