import { bus } from '@/shared/events';
import { watch } from '@/shared/watch';
import { type EmergencyOrigin, normalizeOrigin } from './logic/packet';

const FRESH_MS = 60_000;
let last: { origin: EmergencyOrigin; at: number } | undefined;

bus.on('emergency:open', ({ origin }) => {
  const value = normalizeOrigin(origin);
  if (value) last = { origin: value, at: Date.now() };
});

export function takeOrigin(param?: unknown): EmergencyOrigin {
  const fromParam = normalizeOrigin(param);
  if (fromParam) return fromParam;
  const now = Date.now();
  if (last && now - last.at < FRESH_MS) return last.origin;
  const envelope = watch.lastReceived();
  if (envelope?.type === 'emergency' && now - new Date(envelope.sentAt).getTime() < FRESH_MS) {
    const value = normalizeOrigin((envelope.payload as { origin?: string }).origin);
    if (value) return value;
  }
  return 'button';
}
