export const ASK_AFTER_MS = 45_000;
export const UNRESPONSIVE_AFTER_ASK_MS = 30_000;

export type Response = 'responding' | 'asking' | 'unresponsive';

export function responseOf(lastTouchAt: number, now: number, stepSeconds = 0): Response {
  const idle = now - lastTouchAt;
  const askAfter = ASK_AFTER_MS + Math.max(0, stepSeconds) * 1000;
  if (idle < askAfter) return 'responding';
  return idle < askAfter + UNRESPONSIVE_AFTER_ASK_MS ? 'asking' : 'unresponsive';
}

export function secondsLeft(lastTouchAt: number, now: number, stepSeconds = 0): number {
  const limit = ASK_AFTER_MS + Math.max(0, stepSeconds) * 1000 + UNRESPONSIVE_AFTER_ASK_MS;
  return Math.max(0, Math.ceil((lastTouchAt + limit - now) / 1000));
}
