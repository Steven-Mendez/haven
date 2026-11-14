import { isValidMissionCode, normalizeMissionCode } from './code';
import type { CrewOption } from './crew';

export type Invite = {
  code: string;
  crew?: string;
  apiUrl?: string;
};

type Param = string | string[] | undefined;

const CREW_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTP_URL_PATTERN = /^https?:\/\/[^\s/?#@]+(?:\/[^\s?#]*)?$/i;

const first = (value: Param): string | undefined =>
  (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

function decoded(value: string): string {
  if (!/%[0-9a-f]{2}/i.test(value)) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

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

export function invitedMember(
  crew: CrewOption[] | undefined,
  id: string | undefined,
): CrewOption | undefined {
  return id ? crew?.find((c) => c.id === id) : undefined;
}
