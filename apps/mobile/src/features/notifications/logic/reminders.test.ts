import { type Assessment, loadConfig } from '@haven/core';
import { describe, expect, it } from 'vitest';
import {
  ACTION,
  levelsOf,
  nagHours,
  newlyRed,
  parseValue,
  planReminders,
  planSignature,
  type ReminderTarget,
  reminderTargets,
  resolveResponse,
} from './reminders';

const NOW = new Date('2026-11-01T12:30:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const DEFAULT = 'expo.modules.notifications.actions.DEFAULT';

const bp: ReminderTarget = {
  id: 'systolic-bp',
  zone: 'heart',
  indicators: ['systolic-bp'],
  everyHours: 24,
  kind: 'indicator',
  acceptsValue: true,
};

describe('reminderTargets', () => {
  it('takes the daily actions of the config, skipping shelter and routine checks', () => {
    const targets = reminderTargets(loadConfig());
    const ids = targets.map((t) => t.id);
    expect(ids).toContain('systolic-bp');
    expect(ids).toContain('cognition');
    expect(ids).toContain('wellbeing');
    expect(ids).not.toContain('routine');
    expect(ids).not.toContain('solar-event');
    const cognition = targets.find((t) => t.id === 'cognition');
    expect(cognition).toMatchObject({ kind: 'screen', acceptsValue: false });
    expect(targets.find((t) => t.id === 'glucose')?.acceptsValue).toBe(true);
  });
});

describe('planReminders', () => {
  it('a future due time is used as is', () => {
    const [p] = planReminders([bp], { 'systolic-bp': hoursAgo(20) }, NOW);
    expect(p?.overdue).toBe(false);
    expect(p?.at).toBe(new Date(NOW.getTime() + 4 * 3_600_000).toISOString());
  });

  it('an overdue target repeats every nagHours, aligned to the due time', () => {
    const [p] = planReminders([bp], { 'systolic-bp': hoursAgo(25.5) }, NOW);
    expect(p?.overdue).toBe(true);
    expect(p?.at).toBe(new Date(NOW.getTime() + 4.5 * 3_600_000).toISOString());
    expect(nagHours(24)).toBe(6);
    expect(nagHours(2)).toBe(1);
  });

  it('is stable between calls a few seconds apart', () => {
    const last = { 'systolic-bp': hoursAgo(30) };
    const a = planReminders([bp], last, NOW);
    const b = planReminders([bp], last, new Date(NOW.getTime() + 20_000));
    expect(planSignature(a)).toBe(planSignature(b));
  });

  it('never schedules in the past or within a minute', () => {
    const [p] = planReminders([bp], { 'systolic-bp': hoursAgo(30) }, NOW);
    expect(Date.parse(p?.at ?? '') - NOW.getTime()).toBeGreaterThanOrEqual(60_000);
  });

  it('caps and sorts by time', () => {
    const targets = [bp, { ...bp, id: 'glucose', indicators: ['glucose'], everyHours: 2 }];
    const plan = planReminders(
      targets,
      { 'systolic-bp': hoursAgo(1), glucose: hoursAgo(1) },
      NOW,
      1,
    );
    expect(plan.map((p) => p.target.id)).toEqual(['glucose']);
  });
});

function a(indicator: string, level: Assessment['level']): Assessment {
  return {
    indicator,
    level,
    explanation: { es: '', en: '' },
    actions: [],
    ageMin: 0,
    simulated: true,
  };
}

describe('newlyRed', () => {
  it('alerts only on the transition to red, never on the first evaluation', () => {
    expect(newlyRed(undefined, [a('spo2', 'red')])).toEqual([]);
    const prev = levelsOf([a('spo2', 'amber'), a('heart-rate', 'red')]);
    const next = [a('spo2', 'red'), a('heart-rate', 'red'), a('glucose', 'green')];
    expect(newlyRed(prev, next).map((x) => x.indicator)).toEqual(['spo2']);
  });
});

describe('resolveResponse', () => {
  const reminder = { kind: 'reminder', target: 'glucose', targetKind: 'indicator' };
  const screen = { kind: 'reminder', target: 'cognition', targetKind: 'screen' };

  it('"Open emergency" opens the emergency whatever the data', () => {
    expect(
      resolveResponse({
        actionIdentifier: ACTION.openEmergency,
        data: {},
        defaultActionIdentifier: DEFAULT,
      }),
    ).toEqual({ kind: 'openEmergency' });
  });

  it('"Register" with a typed number saves in the background', () => {
    expect(
      resolveResponse({
        actionIdentifier: ACTION.register,
        data: reminder,
        userText: ' 98,5 ',
        defaultActionIdentifier: DEFAULT,
      }),
    ).toEqual({ kind: 'save', indicator: 'glucose', value: 98.5 });
  });

  it('"Register" without a value, or a tap, opens the page', () => {
    expect(
      resolveResponse({
        actionIdentifier: ACTION.register,
        data: reminder,
        defaultActionIdentifier: DEFAULT,
      }),
    ).toEqual({ kind: 'navigate', path: '/indicator/glucose' });
    expect(
      resolveResponse({
        actionIdentifier: DEFAULT,
        data: screen,
        defaultActionIdentifier: DEFAULT,
      }),
    ).toEqual({ kind: 'navigate', path: '/cognition' });
  });

  it('ignores foreign notifications and parses numbers strictly', () => {
    expect(
      resolveResponse({
        actionIdentifier: DEFAULT,
        data: { url: 'x' },
        defaultActionIdentifier: DEFAULT,
      }),
    ).toEqual({ kind: 'none' });
    expect(parseValue('abc')).toBeUndefined();
    expect(parseValue('120')).toBe(120);
  });
});
