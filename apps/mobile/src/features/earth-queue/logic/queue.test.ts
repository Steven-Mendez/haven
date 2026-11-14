import type { Packet } from '@haven/core';
import { describe, expect, it } from 'vitest';
import {
  applyOutcome,
  backoffMs,
  baseId,
  canSend,
  classifyResponse,
  createEntry,
  displayStatus,
  isDue,
  linkIsDown,
  mergeIncoming,
  pendingCount,
  prepareSend,
  pruneSent,
  RETRY_MAX_MS,
  sortEntries,
  versionOf,
} from './queue';

const T0 = new Date('2026-11-01T10:00:00.000Z');
const at = (s: number) => new Date(T0.getTime() + s * 1000);

function packet(id = 'p1', type: Packet['type'] = 'routine'): Packet {
  return {
    id,
    type,
    crewMember: 'elena-vega',
    assessments: [],
    readings: [],
    notes: '',
    mission: 'ARES01',
    createdAt: T0.toISOString(),
    sentAt: T0.toISOString(),
    visibleAt: T0.toISOString(),
  };
}

describe('stamping', () => {
  it('no artificial delay: visibleAt = sentAt = now', () => {
    const e = createEntry(packet(), T0);
    expect(e.packet.sentAt).toBe(T0.toISOString());
    expect(e.packet.visibleAt).toBe(T0.toISOString());
    expect(e.status).toBe('pending');
  });

  it('re-stamps sentAt when the packet actually leaves, keeping createdAt', () => {
    const e = createEntry(packet(), T0);
    const sent = prepareSend(e, at(600));
    expect(sent.sentAt).toBe(at(600).toISOString());
    expect(sent.visibleAt).toBe(at(600).toISOString());
    expect(sent.createdAt).toBe(T0.toISOString());
  });
});

describe('sending rules', () => {
  it('needs network, link on and an API URL', () => {
    expect(canSend({ linkDown: false, online: true, apiUrl: 'http://x' })).toBe(true);
    expect(canSend({ linkDown: true, online: true, apiUrl: 'http://x' })).toBe(false);
    expect(canSend({ linkDown: false, online: false, apiUrl: 'http://x' })).toBe(false);
    expect(canSend({ linkDown: false, online: true, apiUrl: ' ' })).toBe(false);
  });

  it('detects the link: down without network or address, or after two misses in a row', () => {
    const up = { online: true, apiUrl: 'http://x', misses: 0 };
    expect(linkIsDown(up)).toBe(false);
    expect(linkIsDown({ ...up, misses: 1 })).toBe(false);
    expect(linkIsDown({ ...up, misses: 2 })).toBe(true);
    expect(linkIsDown({ ...up, online: false })).toBe(true);
    expect(linkIsDown({ ...up, apiUrl: '' })).toBe(true);
  });

  it('backoff doubles from 5 s and is capped', () => {
    expect(backoffMs(1)).toBe(5_000);
    expect(backoffMs(2)).toBe(10_000);
    expect(backoffMs(3)).toBe(20_000);
    expect(backoffMs(50)).toBe(RETRY_MAX_MS);
  });

  it('classifies 201, duplicate 200, 4xx and 5xx', () => {
    const receipt = { id: 'p1', receivedAt: T0.toISOString(), visibleAt: T0.toISOString() };
    expect(classifyResponse(201, receipt)).toMatchObject({ kind: 'ok', duplicate: false });
    expect(classifyResponse(200, { ...receipt, duplicate: true })).toMatchObject({
      kind: 'ok',
      duplicate: true,
    });
    expect(classifyResponse(400, { error: 'Invalid packet' })).toEqual({
      kind: 'rejected',
      error: 'Invalid packet',
    });
    expect(classifyResponse(429, {}).kind).toBe('retry');
    expect(classifyResponse(503, {}).kind).toBe('retry');
    expect(classifyResponse(201, {}).kind).toBe('retry');
  });
});

describe('outcomes and statuses', () => {
  it('a failed attempt schedules a retry; the entry is not due until then', () => {
    const e = createEntry(packet(), T0);
    expect(isDue(e, T0)).toBe(true);
    const failed = applyOutcome(e, e.packet, { kind: 'retry', error: 'offline' }, T0);
    expect(failed.status).toBe('pending');
    expect(failed.attempts).toBe(1);
    expect(isDue(failed, at(4))).toBe(false);
    expect(isDue(failed, at(5))).toBe(true);
  });

  it('a duplicate counts as success', () => {
    const e = createEntry(packet(), T0);
    const ok = applyOutcome(
      e,
      e.packet,
      { kind: 'ok', receivedAt: at(1).toISOString(), duplicate: true },
      at(1),
    );
    expect(ok.status).toBe('sent');
    expect(ok.duplicate).toBe(true);
    expect(isDue(ok, at(100))).toBe(false);
  });

  it('queued → sending → received by Earth, with its receive time', () => {
    const e = createEntry(packet(), T0);
    expect(displayStatus(e)).toBe('queued');
    expect(displayStatus(e, true)).toBe('sending');
    const ok = applyOutcome(
      e,
      e.packet,
      { kind: 'ok', receivedAt: at(2).toISOString(), duplicate: false },
      at(2),
    );
    expect(displayStatus(ok)).toBe('received');
    expect(ok.receivedAt).toBe(at(2).toISOString());
  });

  it('a rejected packet is no longer retried', () => {
    const e = createEntry(packet(), T0);
    const bad = applyOutcome(e, e.packet, { kind: 'rejected', error: 'Invalid' }, T0);
    expect(displayStatus(bad)).toBe('rejected');
    expect(isDue(bad, at(1000))).toBe(false);
  });
});

describe('lists', () => {
  it('counts only packets waiting to leave', () => {
    const a = createEntry(packet('a'), T0);
    const b = { ...createEntry(packet('b'), T0), status: 'sent' as const };
    const c = { ...createEntry(packet('c'), T0), status: 'rejected' as const };
    expect(pendingCount([a, b, c])).toBe(1);
  });

  it('sorts pending first, then newest', () => {
    const a = { ...createEntry(packet('a'), T0), status: 'sent' as const };
    const b = createEntry(packet('b'), at(1));
    const c = { ...createEntry(packet('c'), at(2)), status: 'sent' as const };
    expect(sortEntries([a, b, c]).map((e) => e.packet.id)).toEqual(['b', 'c', 'a']);
  });

  it('prunes old sent entries but never unsent ones', () => {
    const sent = [0, 1, 2].map((i) => ({
      ...createEntry(packet(`s${i}`), at(i)),
      status: 'sent' as const,
    }));
    const pending = createEntry(packet('p'), at(-100));
    const kept = pruneSent([...sent, pending], 2).map((e) => e.packet.id);
    expect(kept).toEqual(['s1', 's2', 'p']);
  });
});

describe('mergeIncoming (same packet id again)', () => {
  const emergency = (notes: string): Packet => ({ ...packet('e1', 'emergency'), notes });
  const sentEntry = (p: Packet) => ({
    ...createEntry(p, T0),
    status: 'sent' as const,
    receivedAt: at(1).toISOString(),
  });

  it('a new id is added', () => {
    expect(mergeIncoming([], emergency(''), T0).action).toBe('added');
  });

  it('a pending packet with the same id is replaced in place, without duplicating', () => {
    const first = createEntry(emergency(''), T0);
    const result = mergeIncoming([first], emergency('note added'), at(30));
    expect(result.action).toBe('replaced');
    expect(result.entry.packet.id).toBe('e1');
    expect(result.entry.packet.notes).toBe('note added');
    expect(result.entry.enqueuedAt).toBe(first.enqueuedAt);
    expect(result.entry.attempts).toBe(0);
  });

  it('a rejected packet with the same id is replaced too (new chance)', () => {
    const bad = { ...createEntry(emergency(''), T0), status: 'rejected' as const };
    const result = mergeIncoming([bad], emergency('fixed'), at(1));
    expect(result).toMatchObject({ action: 'replaced', entry: { status: 'pending' } });
  });

  it('an already sent packet with identical content is ignored', () => {
    const sent = sentEntry(emergency('x'));
    const again = {
      ...emergency('x'),
      sentAt: at(99).toISOString(),
      visibleAt: at(110).toISOString(),
    };
    expect(mergeIncoming([sent], again, at(100))).toEqual({
      action: 'ignored',
      entry: sent,
    });
  });

  it('a re-emit with only a new createdAt is not new content', () => {
    const sent = sentEntry(emergency('x'));
    const again = { ...emergency('x'), createdAt: at(500).toISOString() };
    expect(mergeIncoming([sent], again, at(500)).action).toBe('ignored');
  });

  it('an already sent packet with new content is queued as the next version', () => {
    const v1 = sentEntry(emergency(''));
    const v2 = mergeIncoming([v1], emergency('after follow-up'), at(100));
    expect(v2).toMatchObject({ action: 'versioned', entry: { status: 'pending' } });
    expect(v2.entry.packet.id).toBe('e1~v2');
    const v2b = mergeIncoming([v1, v2.entry], emergency('final'), at(110));
    expect(v2b.action).toBe('replaced');
    expect(v2b.entry.packet.id).toBe('e1~v2');
    const v3 = mergeIncoming([v1, { ...v2b.entry, status: 'sent' }], emergency('closed'), at(200));
    expect(v3.entry.packet.id).toBe('e1~v3');
  });

  it('baseId and versionOf read the suffix', () => {
    expect(baseId('e1~v3')).toBe('e1');
    expect(versionOf('e1~v3')).toBe(3);
    expect(baseId('e1')).toBe('e1');
    expect(versionOf('e1')).toBe(1);
    expect(baseId('a~vx')).toBe('a~vx');
  });
});
