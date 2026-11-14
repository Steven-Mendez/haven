import type { Packet } from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { registerQueueCounter, store } from '@/shared/data';
import { db } from '@/shared/db';
import { bus } from '@/shared/events';
import { applyExclusions, type Exclusions, normalizeIncoming } from './logic/compose';
import {
  applyOutcome,
  canSend,
  classifyResponse,
  isDue,
  linkIsDown,
  mergeIncoming,
  pendingCount,
  prepareSend,
  pruneSent,
  type QueueEntry,
  type SendOutcome,
  sortEntries,
} from './logic/queue';

const collection = db.collection<QueueEntry>('queue');
const TICK_MS = 2_000;
const REQUEST_TIMEOUT_MS = 10_000;
const PROBE_MS = 15_000;
const PROBE_TIMEOUT_MS = 5_000;

let entries: QueueEntry[] = [];
let snapshot: QueueEntry[] = [];
let online = true;
let started = false;
let flushing: Promise<void> | null = null;
let flushAgain = false;
let misses = 0;
let probing = false;
let generation = 0;
const listeners = new Set<() => void>();

function publish() {
  snapshot = sortEntries(entries);
  for (const listener of [...listeners]) listener();
  void store.refreshPendingSends();
}

let sending = new Set<string>();
let sendingSnapshot: ReadonlySet<string> = sending;

function setSending(id: string, on: boolean) {
  sending = new Set(sending);
  if (on) sending.add(id);
  else sending.delete(id);
  sendingSnapshot = sending;
  for (const listener of [...listeners]) listener();
}

async function save(entry: QueueEntry) {
  entries = entries.some((e) => e.packet.id === entry.packet.id)
    ? entries.map((e) => (e.packet.id === entry.packet.id ? entry : e))
    : [...entries, entry];
  publish();
  try {
    await collection.put(entry.packet.id, entry);
  } catch (error) {
    console.warn('[earth-queue] could not persist entry', error);
  }
}

export async function enqueue(packet: Packet): Promise<QueueEntry> {
  const result = mergeIncoming(entries, packet, new Date());
  if (result.action === 'ignored') return result.entry;
  const { entry } = result;
  await save(entry);
  bus.emit('packet:queued', entry.packet);
  void flush();
  return entry;
}

export function enqueueRoutine(packet: Packet, exclusions: Exclusions): Promise<QueueEntry> {
  return enqueue(applyExclusions(packet, exclusions));
}

export async function discard(id: string): Promise<void> {
  entries = entries.filter((e) => e.packet.id !== id);
  publish();
  await collection.remove(id).catch(() => undefined);
}

export function retryNow(): Promise<void> {
  entries = entries.map((e) => (e.status === 'pending' ? { ...e, nextAttemptAt: undefined } : e));
  publish();
  return flush();
}

async function post(apiUrl: string, packet: Packet): Promise<SendOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/packets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...packet, currentMission: store.mission() }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => undefined);
    return classifyResponse(response.status, body);
  } catch (error) {
    return { kind: 'retry', error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function updateLink() {
  const down = linkIsDown({ online, apiUrl: store.preferences().apiUrl, misses });
  if (down !== store.mission().linkDown) void store.setMission({ linkDown: down });
}

async function probe(): Promise<void> {
  const base = store.preferences().apiUrl.trim().replace(/\/+$/, '');
  if (probing) return;
  if (!online || !base) return updateLink();
  probing = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/api/health`, { signal: controller.signal });
    misses = response.ok ? 0 : misses + 1;
  } catch {
    misses++;
  } finally {
    clearTimeout(timer);
    probing = false;
  }
  updateLink();
}

export function linkState() {
  const { apiUrl } = store.preferences();
  return { linkDown: store.mission().linkDown, online, apiUrl };
}

export function flush(): Promise<void> {
  if (flushing) {
    flushAgain = true;
    return flushing;
  }
  const startedIn = generation;
  flushing = (async () => {
    do {
      flushAgain = false;
      const queue = [...entries]
        .filter((e) => isDue(e, new Date()))
        .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
      for (const entry of queue) {
        if (generation !== startedIn) return;
        const state = linkState();
        if (!canSend(state)) break;
        const now = new Date();
        const sent = prepareSend(entry, now);
        setSending(entry.packet.id, true);
        const outcome = await post(state.apiUrl, sent).finally(() =>
          setSending(entry.packet.id, false),
        );
        if (generation !== startedIn) return;
        const current = entries.find((e) => e.packet.id === entry.packet.id);
        if (!current) continue;
        const replacedInFlight = current.packet !== entry.packet;
        if (replacedInFlight && outcome.kind === 'ok') {
          await save(applyOutcome(entry, sent, outcome, new Date()));
          await enqueue(current.packet);
          continue;
        }
        if (outcome.kind === 'ok' && misses > 0) {
          misses = 0;
          updateLink();
        }
        await save(applyOutcome(current, sent, outcome, new Date()));
        if (outcome.kind === 'retry') break;
      }
    } while (flushAgain);
    const pruned = pruneSent(entries);
    if (pruned.length !== entries.length) {
      const keep = new Set(pruned.map((e) => e.packet.id));
      for (const e of entries) if (!keep.has(e.packet.id)) void collection.remove(e.packet.id);
      entries = pruned;
      publish();
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

function fromBus(packet: Packet) {
  const normalized = normalizeIncoming(packet, {
    id: randomUUID(),
    crewMember: store.preferences().crewMember,
    mission: store.mission().code,
    now: new Date(),
  });
  void enqueue(normalized);
}

export async function resetQueue(): Promise<void> {
  generation++;
  entries = [];
  sending = new Set();
  sendingSnapshot = sending;
  publish();
  try {
    await collection.clear();
  } catch (error) {
    console.warn('[earth-queue] could not clear the queue', error);
  }
}

export async function startEarthQueue(): Promise<void> {
  if (started) return;
  started = true;
  try {
    entries = await collection.all();
  } catch (error) {
    console.warn('[earth-queue] could not load the queue', error);
    entries = [];
  }
  registerQueueCounter(() => pendingCount(entries));
  publish();

  bus.on('data:reset', () => void resetQueue());

  bus.on('emergency:close', ({ packet }) => fromBus(packet));
  bus.on('packet:enqueue', ({ packet }) => fromBus(packet));
  let wasDown = store.mission().linkDown;
  bus.on('mission:changed', (mission) => {
    if (wasDown && !mission.linkDown) void retryNow();
    wasDown = mission.linkDown;
  });
  let apiUrl = store.preferences().apiUrl;
  store.subscribe('preferences', () => {
    if (store.preferences().apiUrl !== apiUrl) {
      apiUrl = store.preferences().apiUrl;
      misses = 0;
      void probe();
    }
    void flush();
  });

  try {
    const state = await getNetworkStateAsync();
    online = state.isConnected !== false;
  } catch {
    online = true;
  }
  try {
    addNetworkStateListener((state) => {
      const next = state.isConnected !== false;
      if (next === online) return;
      online = next;
      publish();
      void probe();
    });
  } catch {}
  setInterval(() => {
    if (entries.some((e) => isDue(e, new Date()))) void flush();
  }, TICK_MS);
  setInterval(() => void probe(), PROBE_MS);
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void probe();
  });
  void probe();
  void flush();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useQueue(): QueueEntry[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

export function useSending(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => sendingSnapshot,
    () => sendingSnapshot,
  );
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => online,
    () => online,
  );
}

export { randomUUID as newPacketId };
