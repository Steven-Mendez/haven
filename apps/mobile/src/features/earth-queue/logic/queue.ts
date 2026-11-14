import type { Packet } from '@haven/core';

// M09 · Pure queue logic: stamping, retries, statuses and counters. No I/O, no clock: `now` comes in.
// «Producto real»: no artificial delay. `visibleAt` = `sentAt` (Earth sets it to its receive time);
// the communication delay of the environment is mission data, not something the queue simulates.

/** Persisted queue entry (`db.collection('queue')`). */
export type QueueEntry = {
  packet: Packet;
  /** `pending`: waiting for link or retry · `sent`: Earth received it · `rejected`: Earth refused it (4xx). */
  status: 'pending' | 'sent' | 'rejected';
  enqueuedAt: string;
  attempts: number;
  /** Earliest time of the next attempt (ISO); undefined = as soon as there is link. */
  nextAttemptAt?: string;
  lastError?: string;
  /** Earth's receive time from the `POST /api/packets` answer (server clock). */
  receivedAt?: string;
  duplicate?: boolean;
};

/** What the screen shows: queued → sending → received by Earth (or rejected). */
export type DisplayStatus = 'queued' | 'sending' | 'received' | 'rejected';

/** First retry after 5 s, doubling up to 5 min. */
export const RETRY_BASE_MS = 5_000;
export const RETRY_MAX_MS = 5 * 60_000;

export function backoffMs(attempts: number): number {
  const n = Math.max(0, attempts - 1);
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(n, 20));
}

/** `sentAt = visibleAt = now`: the packet carries no invented delay. */
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

/** The packet as it leaves: `sentAt` is the real send time (`createdAt` keeps its real age). */
export function prepareSend(entry: QueueEntry, now: Date): Packet {
  return stampPacket(entry.packet, now);
}

/** Whether to try this entry now. */
export function isDue(entry: QueueEntry, now: Date): boolean {
  if (entry.status !== 'pending') return false;
  return !entry.nextAttemptAt || entry.nextAttemptAt <= now.toISOString();
}

/** Misses in a row before the link counts as down: one lost answer is not an outage. */
export const MISSES_FOR_LINK_DOWN = 2;

/**
 * Automatic link state: down without network, without an Earth address, or after
 * `MISSES_FOR_LINK_DOWN` unanswered checks in a row; up again with the first answer.
 */
export function linkIsDown(state: { online: boolean; apiUrl: string; misses: number }): boolean {
  return !state.online || state.apiUrl.trim().length === 0 || state.misses >= MISSES_FOR_LINK_DOWN;
}

/** The link allows sending: network present and the link detected up. */
export function canSend(state: { linkDown: boolean; online: boolean; apiUrl: string }): boolean {
  return !state.linkDown && state.online && state.apiUrl.trim().length > 0;
}

export type SendOutcome =
  | { kind: 'ok'; receivedAt: string; duplicate: boolean }
  | { kind: 'retry'; error: string }
  | { kind: 'rejected'; error: string };

/**
 * Classifies the API answer. 201 = new, 200 + `duplicate: true` = already received (also success).
 * 4xx except 408/429 is final; 5xx, 408, 429 and network errors are retried.
 */
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

/** Applies the outcome of one attempt. `sent` is the packet exactly as it left. */
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

/** `sending` is not persisted: the service passes the ids currently in flight. */
export function displayStatus(entry: QueueEntry, sending = false): DisplayStatus {
  if (entry.status === 'rejected') return 'rejected';
  if (entry.status === 'sent') return 'received';
  return sending ? 'sending' : 'queued';
}

/** Packets waiting to leave the phone: the mission header counter. */
export function pendingCount(entries: QueueEntry[]): number {
  return entries.filter((e) => e.status === 'pending').length;
}

/** Newest first; pending on top. */
export function sortEntries(entries: QueueEntry[]): QueueEntry[] {
  const rank = { pending: 0, rejected: 1, sent: 2 } as const;
  return [...entries].sort(
    (a, b) => rank[a.status] - rank[b.status] || b.enqueuedAt.localeCompare(a.enqueuedAt),
  );
}

/** Keeps every unsent entry and only the `keep` most recent sent ones. */
export function pruneSent(entries: QueueEntry[], keep = 30): QueueEntry[] {
  const sent = entries
    .filter((e) => e.status === 'sent')
    .sort((a, b) => b.enqueuedAt.localeCompare(a.enqueuedAt));
  const drop = new Set(sent.slice(keep).map((e) => e.packet.id));
  return entries.filter((e) => !drop.has(e.packet.id));
}

// ─── Re-enqueueing the same packet id (M06 re-emits `emergency:close` with the same id) ───────────
//
// Rule:
// - The latest version of that id has not left yet (pending or rejected) → it is REPLACED in place
//   (same entry, new content, retries reset): never two copies of the same packet in the queue.
// - It already left (sent) and the content is identical → IGNORED (nothing new for Earth).
// - It already left and the content changed → a NEW VERSION is queued with id `<id>~v<n>` (n = 2, 3…).
//   Earth is idempotent by id (a resend with the same id answers `duplicate: true` and keeps the old
//   content), so an update needs its own id. The sent version stays in the list as it was.
// "Content" ignores the stamps `sentAt`, `visibleAt` and `createdAt`, and the id itself.
// Note: each `emergency:close` that changes content after a send becomes a version; the emitter
// should only emit once the packet has content (see M06).

const VERSION_SEPARATOR = '~v';

/** Id without the version suffix: `abc~v3` → `abc`. */
export function baseId(id: string): string {
  const i = id.lastIndexOf(VERSION_SEPARATOR);
  return i > 0 && /^\d+$/.test(id.slice(i + VERSION_SEPARATOR.length)) ? id.slice(0, i) : id;
}

export function versionOf(id: string): number {
  return id === baseId(id) ? 1 : Number(id.slice(id.lastIndexOf(VERSION_SEPARATOR) + 2));
}

/** Same content, ignoring id and time stamps. */
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

/** Decides what enqueueing `packet` does given the current entries (see the rule above). */
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
