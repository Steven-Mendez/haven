// QR invite from Earth: `haven://join?mission=MPY2UR&crew=ana-ruiz&api=http%3A%2F%2F192.168.1.21%3A3000`.
// Scanned with the system Camera; one QR per astronaut. Pure: only relative modules.

import { isValidMissionCode, normalizeMissionCode } from './code';
import type { CrewOption } from './crew';

export type Invite = {
  code: string;
  /** Roster id (slug) of the astronaut the QR was made for. */
  crew?: string;
  /** Earth API base URL, without a trailing slash. */
  apiUrl?: string;
};

type Param = string | string[] | undefined;

/** Same shape as the ids Earth gives (`crewIdFor`): lowercase words joined by dashes. */
const CREW_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTP_URL_PATTERN = /^https?:\/\/[^\s/?#@]+(?:\/[^\s?#]*)?$/i;

const first = (value: Param): string | undefined =>
  (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

/** Decodes a value that is still URL-encoded (`http%3A%2F%2F…`); leaves anything else as it is. */
function decoded(value: string): string {
  if (!/%[0-9a-f]{2}/i.test(value)) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** An Earth base URL from the QR, or `undefined` if it is not an http(s) URL (then it is ignored). */
export function parseApiUrl(value: Param): string | undefined {
  const raw = first(value);
  if (!raw) return undefined;
  const url = decoded(raw);
  return HTTP_URL_PATTERN.test(url) ? url.replace(/\/+$/, '') : undefined;
}

export function parseCrewId(value: Param): string | undefined {
  const id = first(value);
  return id && id.length <= 60 && CREW_ID_PATTERN.test(id) ? id : undefined;
}

/**
 * Reads the route params of `haven://join`. The mission code is required (`invalid` otherwise);
 * a malformed `crew` or `api` is dropped and the join goes on without it.
 */
export function parseInvite(params: {
  mission?: Param;
  crew?: Param;
  api?: Param;
}): { ok: true; invite: Invite } | { ok: false; error: 'invalid' } {
  const raw = first(params.mission);
  const code = raw ? normalizeMissionCode(raw) : '';
  if (!raw || raw.replace(/[\s-]/g, '').length !== code.length || !isValidMissionCode(code)) {
    return { ok: false, error: 'invalid' };
  }
  const crew = parseCrewId(params.crew);
  const apiUrl = parseApiUrl(params.api);
  return { ok: true, invite: { code, ...(crew ? { crew } : {}), ...(apiUrl ? { apiUrl } : {}) } };
}

/** The roster entry the QR names, if mission control has it in this mission. */
export function invitedMember(
  crew: CrewOption[] | undefined,
  id: string | undefined,
): CrewOption | undefined {
  return id ? crew?.find((c) => c.id === id) : undefined;
}
