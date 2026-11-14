import type { NotificationTexts } from './i18n';
import type { NotificationData } from './logic/reminders';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';
export type Response = { actionIdentifier: string; data: unknown; userText?: string };
export type Content = { title: string; body: string; data: NotificationData; category: string };

export const supported = false;
export const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT';

export async function setup(_t: NotificationTexts): Promise<void> {}
export async function permission(): Promise<PermissionState> {
  return 'unsupported';
}
export async function requestPermission(): Promise<PermissionState> {
  return 'unsupported';
}
export async function present(_c: Content): Promise<void> {}
export async function scheduleAt(_id: string, _c: Content, _at: Date): Promise<void> {}
export async function cancelWithPrefix(_prefix: string): Promise<void> {}
export function onResponse(_listener: (r: Response) => void): () => void {
  return () => {};
}
export function takeLaunchResponse(): Response | null {
  return null;
}
