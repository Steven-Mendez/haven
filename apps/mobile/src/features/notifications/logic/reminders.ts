import { ACTION_SCREENS, type Assessment, type Config, type Level } from '@haven/core';

export const CATEGORY = {
  alert: 'haven_alert',
  reminderValue: 'haven_reminder_value',
  reminderScreen: 'haven_reminder_screen',
} as const;

export const ACTION = { openEmergency: 'open_emergency', register: 'register' } as const;

export const REMINDER_PREFIX = 'haven-reminder-';
export const MAX_REMINDERS = 8;
const HOUR_MS = 3_600_000;
const MIN_LEAD_MS = 60_000;

export type ReminderTarget = {
  id: string;
  zone: string;
  indicators: string[];
  everyHours: number;
  kind: 'indicator' | 'screen';
  acceptsValue: boolean;
};

const NOT_REMINDED = new Set(['routine', 'solar-event', 'radiation-shelter', 'shelter']);

export function reminderTargets(config: Config): ReminderTarget[] {
  const out: ReminderTarget[] = [];
  for (const zone of config.zones) {
    const opens = zone.dailyAction.opens;
    if (NOT_REMINDED.has(opens)) continue;
    const indicator = config.indicators.find((i) => i.id === opens);
    if (indicator?.everyHours) {
      out.push({
        id: opens,
        zone: zone.id,
        indicators: [opens],
        everyHours: indicator.everyHours,
        kind: 'indicator',
        acceptsValue: indicator.kind === 'number',
      });
      continue;
    }
    const target = screenTarget(config, opens, zone.id);
    if (target) out.push(target);
  }
  for (const screen of Object.keys(ACTION_SCREENS)) {
    if (out.some((t) => t.id === screen)) continue;
    const target = screenTarget(config, screen);
    if (target) out.push(target);
  }
  return out;
}

function screenTarget(config: Config, id: string, zone?: string): ReminderTarget | undefined {
  const screen = ACTION_SCREENS[id];
  if (!screen) return undefined;
  const listed = screen
    .map((indicator) => config.indicators.find((i) => i.id === indicator))
    .filter((i) => i !== undefined && !i.extra);
  const hours = listed.map((i) => i?.everyHours).filter((h): h is number => typeof h === 'number');
  const home = zone ?? listed[0]?.zone;
  if (hours.length === 0 || !home) return undefined;
  return {
    id,
    zone: home,
    indicators: [...screen],
    everyHours: Math.min(...hours),
    kind: 'screen',
    acceptsValue: false,
  };
}

export type PlannedReminder = { target: ReminderTarget; at: string; overdue: boolean };

export function nagHours(everyHours: number): number {
  return Math.min(6, Math.max(1, everyHours / 4));
}

export function planReminders(
  targets: ReminderTarget[],
  lastTakenAt: Record<string, string | undefined>,
  now: Date,
  max = MAX_REMINDERS,
): PlannedReminder[] {
  const nowMs = now.getTime();
  const plan: PlannedReminder[] = [];
  for (const target of targets) {
    const last = target.indicators
      .map((id) => lastTakenAt[id])
      .filter((t): t is string => Boolean(t))
      .sort()
      .at(-1);
    const due = last
      ? Date.parse(last) + target.everyHours * HOUR_MS
      : Math.floor(nowMs / HOUR_MS) * HOUR_MS;
    let at = due;
    const overdue = due <= nowMs;
    if (overdue) {
      const nag = nagHours(target.everyHours) * HOUR_MS;
      at = due + Math.ceil((nowMs - due) / nag) * nag;
      if (at - nowMs < MIN_LEAD_MS) at += nag;
    }
    plan.push({ target, at: new Date(at).toISOString(), overdue });
  }
  return plan.sort((a, b) => a.at.localeCompare(b.at)).slice(0, max);
}

export function planSignature(plan: PlannedReminder[]): string {
  return plan.map((p) => `${p.target.id}@${p.at}`).join('|');
}

export function newlyRed(
  previous: Record<string, Level> | undefined,
  next: Assessment[],
): Assessment[] {
  if (!previous) return [];
  return next.filter((a) => a.level === 'red' && previous[a.indicator] !== 'red');
}

export function levelsOf(assessments: Assessment[]): Record<string, Level> {
  return Object.fromEntries(assessments.map((a) => [a.indicator, a.level]));
}

export type NotificationData = {
  kind: 'alert' | 'reminder';
  target: string;
  targetKind: 'indicator' | 'screen';
};

export type ResponseAction =
  | { kind: 'openEmergency' }
  | { kind: 'navigate'; path: string }
  | { kind: 'save'; indicator: string; value: number }
  | { kind: 'none' };

export function parseValue(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const cleaned = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return undefined;
  return Number(cleaned);
}

export function pathFor(data: NotificationData): string {
  return data.targetKind === 'screen' ? `/${data.target}` : `/indicator/${data.target}`;
}

function isData(value: unknown): value is NotificationData {
  const v = value as Partial<NotificationData> | null;
  return (
    !!v &&
    (v.kind === 'alert' || v.kind === 'reminder') &&
    typeof v.target === 'string' &&
    (v.targetKind === 'indicator' || v.targetKind === 'screen')
  );
}

export function resolveResponse(input: {
  actionIdentifier: string;
  data: unknown;
  userText?: string;
  defaultActionIdentifier: string;
}): ResponseAction {
  if (input.actionIdentifier === ACTION.openEmergency) return { kind: 'openEmergency' };
  if (!isData(input.data)) return { kind: 'none' };
  const data = input.data;
  if (input.actionIdentifier === ACTION.register) {
    const value = parseValue(input.userText);
    if (value !== undefined && data.targetKind === 'indicator') {
      return { kind: 'save', indicator: data.target, value };
    }
    return { kind: 'navigate', path: pathFor(data) };
  }
  if (input.actionIdentifier === input.defaultActionIdentifier) {
    return { kind: 'navigate', path: pathFor(data) };
  }
  return { kind: 'none' };
}
