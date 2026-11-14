import { loadConfig } from '@haven/core';
import { describe, expect, it } from 'vitest';
import {
  latestReceived,
  parseRulesResponse,
  pickNewVersion,
  receive,
  withConfirmation,
} from './rules';

const config = loadConfig();
const now = new Date('2026-11-01T12:00:00Z');

const version = (id: string, sentAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  mission: 'ARES01',
  version: `v-${id}`,
  note: 'note',
  author: 'Spica',
  config,
  sentAt,
  receivedAt: null,
  receivedBy: [],
  appliedAt: null,
  appliedBy: [],
  ...extra,
});

describe('Earth rules', () => {
  it('parses valid versions and skips broken ones', () => {
    const parsed = parseRulesResponse({
      mission: 'ARES01',
      versions: [version('a', '2026-11-01T10:00:00Z'), { id: 'b', sentAt: 'x', config: {} }, null],
    });
    expect(parsed.map((v) => v.id)).toEqual(['a']);
    expect(parseRulesResponse(undefined)).toEqual([]);
  });

  it('picks the latest version the phone does not have', () => {
    const versions = parseRulesResponse({
      versions: [
        version('a', '2026-11-01T10:00:00Z'),
        version('b', '2026-11-01T11:00:00Z'),
        version('c', '2026-11-01T13:00:00Z'),
      ],
    });
    expect(pickNewVersion(versions, [])?.id).toBe('c');
    expect(pickNewVersion(versions, ['c'])).toBeUndefined();
    expect(pickNewVersion([], [])).toBeUndefined();
  });

  it('keeps an audit trail of reception and confirmation', () => {
    const [v] = parseRulesResponse({ versions: [version('a', '2026-11-01T10:00:00Z')] });
    const r = receive(v as NonNullable<typeof v>, now);
    expect(r.status).toBe('received');
    const failed = withConfirmation(r, 500, now);
    expect(failed.status).toBe('received');
    expect(failed.audit.at(-1)?.event).toBe('confirm-failed');
    const offline = withConfirmation(failed, 'offline', now);
    expect(offline.audit.at(-1)?.event).toBe('confirm-failed');
    const ok = withConfirmation(offline, 200, new Date('2026-11-01T12:05:00Z'));
    expect(ok).toMatchObject({ status: 'applied', appliedAt: '2026-11-01T12:05:00.000Z' });
    expect(ok.audit.map((a) => a.event)).toEqual([
      'received',
      'confirm-failed',
      'confirm-failed',
      'confirmed',
    ]);
    expect(latestReceived([r, { ...ok, receivedAt: '2026-11-01T12:10:00Z', id: 'z' }])?.id).toBe(
      'z',
    );
  });
});
