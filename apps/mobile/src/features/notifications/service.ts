import type { Assessment, Level } from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { format } from '@/shared/components/haven';
import { config } from '@/shared/config';
import { store } from '@/shared/data';
import { bus } from '@/shared/events';
import { currentLanguage, onLanguageChange } from '@/shared/i18n';
import { type NotificationTexts, texts } from './i18n';
import {
  CATEGORY,
  levelsOf,
  type NotificationData,
  newlyRed,
  type PlannedReminder,
  planReminders,
  planSignature,
  REMINDER_PREFIX,
  type ResponseAction,
  reminderTargets,
  resolveResponse,
} from './logic/reminders';
import * as notifier from './notifier';

// M08 · Local actionable notifications (no push, works without network):
// - alert when an indicator turns red ("Open emergency" · "Register");
// - reminders of the Routine's pending measurements, planned from `everyHours` of the config;
// - responses: "Open emergency" brings the app forward and opens /emergency (via the bus);
//   "Register" opens /indicator/[id] or saves the typed value in the background.

const REPLAN_DEBOUNCE_MS = 10_000;
const REPLAN_EVERY_MS = 30 * 60_000;
const targets = reminderTargets(config);

let started = false;
let previousLevels: Record<string, Level> | undefined;
let signature = '';
let replanTimer: ReturnType<typeof setTimeout> | null = null;
let permissionState: notifier.PermissionState = notifier.supported ? 'undetermined' : 'unsupported';
const listeners = new Set<() => void>();

const t = (): NotificationTexts => texts[currentLanguage()];

function setPermission(next: notifier.PermissionState) {
  permissionState = next;
  for (const listener of [...listeners]) listener();
}

function indicatorName(id: string): string {
  const indicator = config.indicators.find((i) => i.id === id);
  if (indicator) return indicator.name[currentLanguage()];
  if (id === 'cognition') return t().cognition;
  if (id === 'wellbeing') return t().wellbeing;
  return id;
}

async function alertRed(assessment: Assessment) {
  const name = indicatorName(assessment.indicator);
  const data: NotificationData = {
    kind: 'alert',
    target: assessment.indicator,
    targetKind: 'indicator',
  };
  await notifier.present({
    title: format(t().alertTitle, { name }),
    body: assessment.explanation[currentLanguage()] || t().alertFallback,
    data,
    category: CATEGORY.alert,
  });
}

function onAssessments(assessments: Assessment[]) {
  const red = newlyRed(previousLevels, assessments);
  previousLevels = levelsOf(assessments);
  if (permissionState !== 'granted') return;
  for (const a of red)
    void alertRed(a).catch((e) => console.warn('[notifications] alert failed', e));
}

function lastTakenAt(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const target of targets) {
    for (const id of target.indicators) out[id] = store.latestReading(id)?.takenAt;
  }
  return out;
}

function reminderContent(p: PlannedReminder): notifier.Content {
  const name = indicatorName(p.target.id);
  const screen = p.target.kind === 'screen';
  return {
    title: format(screen ? t().reminderScreenTitle : t().reminderTitle, { name }),
    body: screen ? t().reminderScreenBody : t().reminderBody,
    data: { kind: 'reminder', target: p.target.id, targetKind: p.target.kind },
    category: p.target.acceptsValue ? CATEGORY.reminderValue : CATEGORY.reminderScreen,
  };
}

/** Plans the reminders again; only touches the system schedule when the plan changed. */
export async function replanReminders(force = false): Promise<void> {
  if (permissionState !== 'granted') return;
  const plan = planReminders(targets, lastTakenAt(), new Date());
  const next = `${currentLanguage()}#${planSignature(plan)}`;
  if (!force && next === signature) return;
  signature = next;
  try {
    await notifier.cancelWithPrefix(REMINDER_PREFIX);
    for (const p of plan) {
      await notifier.scheduleAt(
        `${REMINDER_PREFIX}${p.target.id}`,
        reminderContent(p),
        new Date(p.at),
      );
    }
  } catch (error) {
    signature = '';
    console.warn('[notifications] could not schedule reminders', error);
  }
}

function scheduleReplan() {
  if (replanTimer) clearTimeout(replanTimer);
  replanTimer = setTimeout(() => void replanReminders(), REPLAN_DEBOUNCE_MS);
}

async function perform(action: ResponseAction) {
  switch (action.kind) {
    case 'openEmergency':
      // The root layout's listener opens /emergency (M06).
      bus.emit('emergency:open', { origin: 'notification' });
      return;
    case 'navigate':
      router.push(action.path as never);
      return;
    case 'save': {
      const indicator = config.indicators.find((i) => i.id === action.indicator);
      await store.saveReading({
        id: randomUUID(),
        indicator: action.indicator,
        value: action.value,
        unit: indicator?.unit ?? '',
        takenAt: new Date().toISOString(),
        source: 'manual',
        simulated: false,
        crewMember: store.preferences().crewMember,
      });
      return;
    }
    default:
      return;
  }
}

function handle(response: notifier.Response) {
  void perform(
    resolveResponse({ ...response, defaultActionIdentifier: notifier.DEFAULT_ACTION }),
  ).catch((e) => console.warn('[notifications] response failed', e));
}

/** Asks for permission (system prompt) and schedules the reminders. */
export async function requestNotificationPermission(): Promise<notifier.PermissionState> {
  try {
    setPermission(await notifier.requestPermission());
  } catch {
    setPermission('denied');
  }
  await replanReminders(true);
  return permissionState;
}

/** Sets categories, asks for permission once, listens to responses, alerts and readings. */
export async function startNotifications(): Promise<void> {
  if (started) return;
  started = true;
  previousLevels = levelsOf(store.assessments());
  bus.on('assessments:changed', onAssessments);
  if (!notifier.supported) return;

  try {
    await notifier.setup(t());
    onLanguageChange(() => {
      void notifier.setup(t());
      void replanReminders(true);
    });
    notifier.onResponse(handle);
    const launch = notifier.takeLaunchResponse();
    if (launch) handle(launch);
    const current = await notifier.permission();
    setPermission(current);
    if (current === 'undetermined') await requestNotificationPermission();
    else await replanReminders(true);
  } catch (error) {
    console.warn('[notifications] setup failed', error);
  }
  bus.on('reading:new', scheduleReplan);
  setInterval(() => void replanReminders(), REPLAN_EVERY_MS);
}

/** Permission state: 'unsupported' on the web. */
export function useNotificationPermission(): notifier.PermissionState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => permissionState,
    () => permissionState,
  );
}
