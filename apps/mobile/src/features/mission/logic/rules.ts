// Versioned rules from Earth (T03 → M05). Pure: only `@haven/core` types and relative modules.
// `GET {apiUrl}/api/rules?mission=CODE&crewMember=ID` → `{ mission, versions: RulesVersion[] }`: the
// versions Earth published for the mission. Each download counts as «received on board» for that
// crew member; they arrive when the phone downloads them. The phone keeps what it received in the `rules` collection.

import type { Config } from '@haven/core';

/** One version as sent by the Earth API (fields the phone uses). */
export type EarthRulesVersion = {
  id: string;
  version: string;
  note: string;
  author: string;
  config: Config;
  /** Created on Earth. */
  sentAt: string;
};

export type RulesStatus =
  /** Stored and confirmed to Earth (`POST … { apply }` answered 2xx). */
  | 'applied'
  /** Stored; confirmation pending (no link or network error). */
  | 'received';

/** A version received on this phone, with its audit trail. */
export type ReceivedRules = EarthRulesVersion & {
  receivedAt: string;
  status: RulesStatus;
  appliedAt?: string;
  /** Whether the shared app config took it (needs `setActiveConfig` in `@/shared/config`). */
  activeLocally: boolean;
  audit: { at: string; event: RulesAuditEvent; detail?: string }[];
};

export type RulesAuditEvent = 'received' | 'confirmed' | 'confirm-failed' | 'activated';

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Minimal shape check of a full `Config`. */
export function isConfig(value: unknown): value is Config {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    Array.isArray(c.zones) &&
    Array.isArray(c.indicators) &&
    Array.isArray(c.environments) &&
    Array.isArray(c.protocols)
  );
}

/** Valid versions of a `GET /api/rules` response (invalid entries are skipped). */
export function parseRulesResponse(response: unknown): EarthRulesVersion[] {
  const list =
    response &&
    typeof response === 'object' &&
    Array.isArray((response as { versions?: unknown }).versions)
      ? (response as { versions: unknown[] }).versions
      : [];
  const out: EarthRulesVersion[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const v = item as Record<string, unknown>;
    if (!isString(v.id) || !isString(v.sentAt) || !isConfig(v.config)) continue;
    out.push({
      id: v.id,
      version: isString(v.version) ? v.version : (v.config as Config).version,
      note: typeof v.note === 'string' ? v.note : '',
      author: typeof v.author === 'string' ? v.author : '',
      config: v.config,
      sentAt: v.sentAt,
    });
  }
  return out;
}

/** The most recent version (latest `sentAt`, then id) that the phone does not have yet. */
export function pickNewVersion(
  versions: EarthRulesVersion[],
  knownIds: Iterable<string>,
): EarthRulesVersion | undefined {
  if (versions.length === 0) return undefined;
  const known = new Set(knownIds);
  const latest = [...versions].sort(
    (a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id),
  )[versions.length - 1] as EarthRulesVersion;
  return known.has(latest.id) ? undefined : latest;
}

/** New record for a received version. */
export function receive(version: EarthRulesVersion, now: Date): ReceivedRules {
  return {
    ...version,
    receivedAt: now.toISOString(),
    status: 'received',
    activeLocally: false,
    audit: [{ at: now.toISOString(), event: 'received', detail: version.version }],
  };
}

/** Records the result of `POST … { apply }`: 2xx → applied, anything else → retried later. */
export function withConfirmation(
  record: ReceivedRules,
  httpStatus: number | 'offline',
  now: Date,
): ReceivedRules {
  const at = now.toISOString();
  if (typeof httpStatus === 'number' && httpStatus >= 200 && httpStatus < 300) {
    return {
      ...record,
      status: 'applied',
      appliedAt: at,
      audit: [...record.audit, { at, event: 'confirmed' }],
    };
  }
  return {
    ...record,
    audit: [...record.audit, { at, event: 'confirm-failed', detail: String(httpStatus) }],
  };
}

/** Latest received record (by `receivedAt`). */
export function latestReceived(records: ReceivedRules[]): ReceivedRules | undefined {
  return [...records].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)).at(-1);
}
