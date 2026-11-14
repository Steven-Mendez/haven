import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { NotificationTexts } from './i18n';
import { ACTION, CATEGORY, type NotificationData } from './logic/reminders';

// M08 · Thin wrapper over expo-notifications (iOS and Android). The web uses notifier.web.ts.
// Categories: "Open emergency" opens the app to the foreground; "Register" on a value reminder is a
// text action that stays in the background (the typed number is saved without opening the app).

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';
export type Response = { actionIdentifier: string; data: unknown; userText?: string };
export type Content = { title: string; body: string; data: NotificationData; category: string };

const CHANNEL = { alerts: 'alerts', reminders: 'reminders' } as const;

export const supported = true;
export const DEFAULT_ACTION = Notifications.DEFAULT_ACTION_IDENTIFIER;

export async function setup(t: NotificationTexts): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL.alerts, {
      name: t.channelAlerts,
      importance: Notifications.AndroidImportance.MAX,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL.reminders, {
      name: t.channelReminders,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const openEmergency = {
    identifier: ACTION.openEmergency,
    buttonTitle: t.actionOpenEmergency,
    options: { opensAppToForeground: true },
  };
  const registerForeground = {
    identifier: ACTION.register,
    buttonTitle: t.actionRegister,
    options: { opensAppToForeground: true },
  };
  await Notifications.setNotificationCategoryAsync(CATEGORY.alert, [
    openEmergency,
    registerForeground,
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORY.reminderValue, [
    {
      identifier: ACTION.register,
      buttonTitle: t.actionRegister,
      textInput: { placeholder: t.valuePlaceholder, submitButtonTitle: t.valueSubmit },
      options: { opensAppToForeground: false },
    },
    openEmergency,
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORY.reminderScreen, [
    registerForeground,
    openEmergency,
  ]);
}

function toState(status: Notifications.NotificationPermissionsStatus): PermissionState {
  if (status.granted) return 'granted';
  if (status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

export async function permission(): Promise<PermissionState> {
  return toState(await Notifications.getPermissionsAsync());
}

export async function requestPermission(): Promise<PermissionState> {
  return toState(
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    }),
  );
}

function content(c: Content): Notifications.NotificationContentInput {
  return {
    title: c.title,
    body: c.body,
    data: c.data as unknown as Record<string, unknown>,
    categoryIdentifier: c.category,
    sound: true,
  };
}

/** Shows a notification now (red alert). */
export async function present(c: Content): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: content(c),
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL.alerts } : null,
  });
}

export async function scheduleAt(identifier: string, c: Content, at: Date): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: content(c),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      channelId: CHANNEL.reminders,
    },
  });
}

export async function cancelWithPrefix(prefix: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(prefix))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

function toResponse(r: Notifications.NotificationResponse): Response {
  return {
    actionIdentifier: r.actionIdentifier,
    data: r.notification.request.content.data,
    userText: r.userText,
  };
}

export function onResponse(listener: (r: Response) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((r) =>
    listener(toResponse(r)),
  );
  return () => subscription.remove();
}

/** The response that launched the app (cold start), consumed once. */
export function takeLaunchResponse(): Response | null {
  const last = Notifications.getLastNotificationResponse();
  if (!last) return null;
  Notifications.clearLastNotificationResponse();
  return toResponse(last);
}
