import type { Config } from '@haven/core';

export type EarthRulesVersion = {
  id: string;
  version: string;
  note: string;
  author: string;
  config: Config;
  sentAt: string;
};

export type RulesStatus = 'applied' | 'received';

export type ReceivedRules = EarthRulesVersion & {
  receivedAt: string;
  status: RulesStatus;
  appliedAt?: string;
  activeLocally: boolean;
  audit: { at: string; event: RulesAuditEvent; detail?: string }[];
};

export type RulesAuditEvent = 'received' | 'confirmed' | 'confirm-failed' | 'activated';

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

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

export function receive(version: EarthRulesVersion, now: Date): ReceivedRules {
  return {
    ...version,
    receivedAt: now.toISOString(),
    status: 'received',
    activeLocally: false,
    audit: [{ at: now.toISOString(), event: 'received', detail: version.version }],
  };
}

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

export function latestReceived(records: ReceivedRules[]): ReceivedRules | undefined {
  return [...records].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)).at(-1);
}
