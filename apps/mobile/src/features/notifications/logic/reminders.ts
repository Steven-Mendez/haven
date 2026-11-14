import { ACTION_SCREENS, type Assessment, type Config, type Level } from '@haven/core';

// M08 · Pure planning of reminders and alerts, and the meaning of each notification response.

/** Category ids (no ':' or '-', per expo-notifications). */
export const CATEGORY = {
  /** Red assessment: "Open emergency" + "Register". */
  alert: 'haven_alert',
  /** Numeric indicator reminder: "Register" lets you type the value from the lock screen. */
  reminderValue: 'haven_reminder_value',
  /** Reminder that opens a screen (cognition, wellbeing): "Register" opens it. */
  reminderScreen: 'haven_reminder_screen',
} as const;

export const ACTION = { openEmergency: 'open_emergency', register: 'register' } as const;

/** Prefix of scheduled reminder identifiers (to cancel them as a group). */
export const REMINDER_PREFIX = 'haven-reminder-';
export const MAX_REMINDERS = 8;
const HOUR_MS = 3_600_000;
/** Never schedule closer than this to now. */
const MIN_LEAD_MS = 60_000;

export type ReminderTarget = {
  /** Indicator id or screen id from `Zone.dailyAction.opens`. */
  id: string;
  zone: string;
  /** Readings that complete it. */
  indicators: string[];
  everyHours: number;
  kind: 'indicator' | 'screen';
  /** The value can be typed in the notification (single numeric indicator). */
  acceptsValue: boolean;
};

/** Screens that are not indicators nor measurements (shelter, routine checks) do not remind. */
const NOT_REMINDED = new Set(['routine', 'solar-event', 'radiation-shelter', 'shelter']);

/** The pending measurements of the Routine (M03): each zone's daily action, from the config. */
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
    const screen = ACTION_SCREENS[opens];
    if (!screen) continue;
    const hours = screen
      .map((id) => config.indicators.find((i) => i.id === id)?.everyHours)
      .filter((h): h is number => typeof h === 'number');
    if (hours.length === 0) continue;
    out.push({
      id: opens,
      zone: zone.id,
      indicators: [...screen],
      everyHours: Math.min(...hours),
      kind: 'screen',
      acceptsValue: false,
    });
  }
  return out;
}

export type PlannedReminder = { target: ReminderTarget; at: string; overdue: boolean };

/** How often an overdue reminder repeats: a quarter of the frequency, between 1 h and 6 h. */
export function nagHours(everyHours: number): number {
  return Math.min(6, Math.max(1, everyHours / 4));
}

/**
 * When to remind each target. Due = last reading + `everyHours`. Overdue targets repeat every
 * `nagHours`, aligned to the due time so the plan is stable between calls (no endless pushing back).
 * Without any reading, the due time is the current hour.
 */
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

/** Stable key of a plan: reschedule only when it changes. */
export function planSignature(plan: PlannedReminder[]): string {
  return plan.map((p) => `${p.target.id}@${p.at}`).join('|');
}

/** Indicators that just turned red. The first evaluation (no previous levels) alerts nothing. */
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

/** Data carried by every HAVEN notification. */
export type NotificationData = {
  kind: 'alert' | 'reminder';
  /** Indicator id or screen id. */
  target: string;
  targetKind: 'indicator' | 'screen';
};

export type ResponseAction =
  | { kind: 'openEmergency' }
  | { kind: 'navigate'; path: string }
  | { kind: 'save'; indicator: string; value: number }
  | { kind: 'none' };

/** Number typed in the notification ("7,2" or "7.2"); `undefined` if it is not a number. */
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

/**
 * What to do with a response: "Open emergency" → emergency; "Register" with a typed number →
 * save in the background; "Register" otherwise, or a tap on the notification → open the page.
 */
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
