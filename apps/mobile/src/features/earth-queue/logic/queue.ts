import type { Packet } from '@haven/core';

export type QueueEntry = {
  packet: Packet;
  status: 'pending' | 'sent' | 'rejected';
  enqueuedAt: string;
  attempts: number;
  nextAttemptAt?: string;
  lastError?: string;
  receivedAt?: string;
  duplicate?: boolean;
};

export type DisplayStatus = 'queued' | 'sending' | 'received' | 'rejected';

export const RETRY_BASE_MS = 5_000;
export const RETRY_MAX_MS = 5 * 60_000;

export function backoffMs(attempts: number): number {
  const n = Math.max(0, attempts - 1);
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(n, 20));
}

export function stampPacket(packet: Packet, now: Date): Packet {
  const sentAt = now.toISOString();
  return { ...packet, sentAt, visibleAt: sentAt };
}

export function createEntry(packet: Packet, now: Date): QueueEntry {
  return {
    packet: stampPacket(packet, now),
    status: 'pending',
    enqueuedAt: now.toISOString(),
    attempts: 0,
  };
}

export function prepareSend(entry: QueueEntry, now: Date): Packet {
  return stampPacket(entry.packet, now);
}

export function isDue(entry: QueueEntry, now: Date): boolean {
  if (entry.status !== 'pending') return false;
  return !entry.nextAttemptAt || entry.nextAttemptAt <= now.toISOString();
}

export const MISSES_FOR_LINK_DOWN = 2;

export function linkIsDown(state: { online: boolean; apiUrl: string; misses: number }): boolean {
  return !state.online || state.apiUrl.trim().length === 0 || state.misses >= MISSES_FOR_LINK_DOWN;
}

export function canSend(state: { linkDown: boolean; online: boolean; apiUrl: string }): boolean {
  return !state.linkDown && state.online && state.apiUrl.trim().length > 0;
}

export type SendOutcome =
  | { kind: 'ok'; receivedAt: string; duplicate: boolean }
  | { kind: 'retry'; error: string }
  | { kind: 'rejected'; error: string };

export function classifyResponse(status: number, body: unknown): SendOutcome {
  const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (status === 200 || status === 201) {
    const receivedAt = typeof data.receivedAt === 'string' ? data.receivedAt : undefined;
    if (!receivedAt) return { kind: 'retry', error: 'malformed receipt' };
    return { kind: 'ok', receivedAt, duplicate: data.duplicate === true };
  }
  const message = typeof data.error === 'string' ? data.error : `HTTP ${status}`;
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return { kind: 'rejected', error: message };
  }
  return { kind: 'retry', error: message };
}

export function applyOutcome(
  entry: QueueEntry,
  sent: Packet,
  outcome: SendOutcome,
  now: Date,
): QueueEntry {
  const attempts = entry.attempts + 1;
  if (outcome.kind === 'ok') {
    return {
      ...entry,
      packet: sent,
      status: 'sent',
      attempts,
      nextAttemptAt: undefined,
      lastError: undefined,
      receivedAt: outcome.receivedAt,
      duplicate: outcome.duplicate,
    };
  }
  if (outcome.kind === 'rejected') {
    return { ...entry, status: 'rejected', attempts, lastError: outcome.error };
  }
  return {
    ...entry,
    attempts,
    lastError: outcome.error,
    nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)).toISOString(),
  };
}

export function displayStatus(entry: QueueEntry, sending = false): DisplayStatus {
  if (entry.status === 'rejected') return 'rejected';
  if (entry.status === 'sent') return 'received';
  return sending ? 'sending' : 'queued';
}

export function pendingCount(entries: QueueEntry[]): number {
  return entries.filter((e) => e.status === 'pending').length;
}

export function sortEntries(entries: QueueEntry[]): QueueEntry[] {
  const rank = { pending: 0, rejected: 1, sent: 2 } as const;
  return [...entries].sort(
    (a, b) => rank[a.status] - rank[b.status] || b.enqueuedAt.localeCompare(a.enqueuedAt),
  );
}

export function pruneSent(entries: QueueEntry[], keep = 30): QueueEntry[] {
  const sent = entries
    .filter((e) => e.status === 'sent')
    .sort((a, b) => b.enqueuedAt.localeCompare(a.enqueuedAt));
  const drop = new Set(sent.slice(keep).map((e) => e.packet.id));
  return entries.filter((e) => !drop.has(e.packet.id));
}

const VERSION_SEPARATOR = '~v';

export function baseId(id: string): string {
  const i = id.lastIndexOf(VERSION_SEPARATOR);
  return i > 0 && /^\d+$/.test(id.slice(i + VERSION_SEPARATOR.length)) ? id.slice(0, i) : id;
}

export function versionOf(id: string): number {
  return id === baseId(id) ? 1 : Number(id.slice(id.lastIndexOf(VERSION_SEPARATOR) + 2));
}

export function sameContent(a: Packet, b: Packet): boolean {
  const { id: _a, sentAt: _sa, visibleAt: _va, createdAt: _ca, ...ra } = a;
  const { id: _b, sentAt: _sb, visibleAt: _vb, createdAt: _cb, ...rb } = b;
  return JSON.stringify(sortKeys(ra)) === JSON.stringify(sortKeys(rb));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export type MergeResult =
  | { action: 'added' | 'replaced' | 'versioned'; entry: QueueEntry }
  | { action: 'ignored'; entry: QueueEntry };

export function mergeIncoming(entries: QueueEntry[], packet: Packet, now: Date): MergeResult {
  const base = baseId(packet.id);
  const versions = entries
    .filter((e) => baseId(e.packet.id) === base)
    .sort((a, b) => versionOf(a.packet.id) - versionOf(b.packet.id));
  const latest = versions[versions.length - 1];
  if (!latest) return { action: 'added', entry: createEntry(packet, now) };
  if (latest.status !== 'sent') {
    const fresh = createEntry({ ...packet, id: latest.packet.id }, now);
    return { action: 'replaced', entry: { ...fresh, enqueuedAt: latest.enqueuedAt } };
  }
  if (sameContent(latest.packet, packet)) return { action: 'ignored', entry: latest };
  const id = `${base}${VERSION_SEPARATOR}${versionOf(latest.packet.id) + 1}`;
  return { action: 'versioned', entry: createEntry({ ...packet, id }, now) };
}
