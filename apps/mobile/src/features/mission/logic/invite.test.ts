import { describe, expect, it } from 'vitest';
import { invitedMember, parseApiUrl, parseCrewId, parseInvite } from './invite';

describe('QR invite', () => {
  it('reads mission, crew and api', () => {
    expect(
      parseInvite({ mission: 'MPY2UR', crew: 'ana-ruiz', api: 'http://192.168.1.21:3000' }),
    ).toEqual({
      ok: true,
      invite: { code: 'MPY2UR', crew: 'ana-ruiz', apiUrl: 'http://192.168.1.21:3000' },
    });
  });

  it('accepts lowercase codes and only needs the mission', () => {
    expect(parseInvite({ mission: ' mpy2ur ' })).toEqual({ ok: true, invite: { code: 'MPY2UR' } });
    expect(parseInvite({ mission: ['ARES01', 'XXXXXX'] })).toEqual({
      ok: true,
      invite: { code: 'ARES01' },
    });
  });

  it('rejects a missing or malformed code', () => {
    expect(parseInvite({})).toEqual({ ok: false, error: 'invalid' });
    expect(parseInvite({ mission: 'ARES0' })).toEqual({ ok: false, error: 'invalid' });
    expect(parseInvite({ mission: 'ARES01X' })).toEqual({ ok: false, error: 'invalid' });
    expect(parseInvite({ mission: 'AR$S01' })).toEqual({ ok: false, error: 'invalid' });
  });

  it('drops a malformed crew id or api instead of failing', () => {
    expect(parseInvite({ mission: 'ARES01', crew: 'Ana Ruiz', api: 'ftp://x' })).toEqual({
      ok: true,
      invite: { code: 'ARES01' },
    });
    expect(parseCrewId('ana-ruiz-2')).toBe('ana-ruiz-2');
    expect(parseCrewId('-ana')).toBeUndefined();
    expect(parseCrewId('ANA')).toBeUndefined();
  });

  it('accepts only http(s) Earth URLs, decoded and without a trailing slash', () => {
    expect(parseApiUrl('http%3A%2F%2Flocalhost%3A3000')).toBe('http://localhost:3000');
    expect(parseApiUrl('https://earth.example.org/haven/')).toBe('https://earth.example.org/haven');
    expect(parseApiUrl('javascript:alert(1)')).toBeUndefined();
    expect(parseApiUrl('http://user@evil.example')).toBeUndefined();
    expect(parseApiUrl('http://')).toBeUndefined();
    expect(parseApiUrl('localhost:3000')).toBeUndefined();
    expect(parseApiUrl(undefined)).toBeUndefined();
  });

  it('finds the invited person in the roster', () => {
    const ana = { id: 'ana-ruiz', name: 'Ana Ruiz', hasWatch: false };
    expect(invitedMember([ana], 'ana-ruiz')).toBe(ana);
    expect(invitedMember([ana], 'leo-park')).toBeUndefined();
    expect(invitedMember(undefined, 'ana-ruiz')).toBeUndefined();
    expect(invitedMember([ana], undefined)).toBeUndefined();
  });
});
