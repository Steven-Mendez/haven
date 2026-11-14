import type { Config } from '@haven/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as sharedConfig from '@/shared/config';
import { store, useMission, usePreferences } from '@/shared/data';
import { db } from '@/shared/db';
import {
  latestReceived,
  parseRulesResponse,
  pickNewVersion,
  type ReceivedRules,
  receive,
  withConfirmation,
} from '../logic/rules';

// Versioned rules from Earth (T03). When the link is up, polls
// `GET {apiUrl}/api/rules?mission=CODE&crewMember=ID` (each download counts as received on board),
// stores the newest version not yet on the phone in the `rules` collection and confirms it with
// `POST {apiUrl}/api/rules?mission=CODE { apply, crewMember }`.
// Never fails without network.
//
// Making the received config drive the evaluation needs an entry point in `@/shared/config` (owned
// by Atlas / the orchestrator). Until it exists, the rules are stored and confirmed but the engine keeps
// the bundled config; `activeLocally` says which one is the case.

const collection = db.collection<ReceivedRules>('rules');
const POLL_MS = 60_000;
const TIMEOUT_MS = 4_000;

/** `setActiveConfig(config)` if `@/shared/config` provides it (proposed to the orchestrator). */
function activate(config: Config): boolean {
  const setter = (sharedConfig as Record<string, unknown>).setActiveConfig;
  if (typeof setter !== 'function') return false;
  try {
    (setter as (c: Config) => void)(config);
    store.reevaluate();
    return true;
  } catch (error) {
    console.warn('[mission] could not activate received rules', error);
    return false;
  }
}

async function call(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.json().catch(() => undefined);
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

export function useEarthRules() {
  const mission = useMission();
  const { apiUrl, crewMember } = usePreferences();
  const [records, setRecords] = useState<ReceivedRules[]>([]);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<'ok' | 'offline' | 'skipped' | undefined>();
  const busy = useRef(false);

  const base = apiUrl.trim().replace(/\/+$/, '');
  const code = mission.code;

  const reload = useCallback(async () => {
    try {
      const all = (await collection.all()).filter((r) => r.config && r.audit);
      setRecords(all);
      return all;
    } catch {
      return [] as ReceivedRules[];
    }
  }, []);

  const confirm = useCallback(
    async (record: ReceivedRules): Promise<ReceivedRules> => {
      let status: number | 'offline' = 'offline';
      try {
        const response = await call(`${base}/api/rules?mission=${encodeURIComponent(code)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apply: record.id, crewMember }),
        });
        status = response.status;
      } catch {
        status = 'offline';
      }
      return withConfirmation(record, status, new Date());
    },
    [base, code, crewMember],
  );

  const check = useCallback(async () => {
    if (busy.current) return;
    if (store.mission().linkDown || !base) {
      setLastCheck('skipped');
      return;
    }
    busy.current = true;
    setChecking(true);
    try {
      const known = await reload();
      let changed = false;
      // Retry confirming versions received earlier (e.g. during a blackout).
      for (const pending of known.filter((r) => r.status === 'received')) {
        const next = await confirm(pending);
        if (next.status !== pending.status || next.audit.length !== pending.audit.length) {
          await collection.put(next.id, next);
          changed = true;
        }
      }
      const response = await call(
        `${base}/api/rules?mission=${encodeURIComponent(code)}&crewMember=${encodeURIComponent(crewMember)}`,
      );
      if (response.status >= 200 && response.status < 300) {
        const fresh = pickNewVersion(
          parseRulesResponse(response.body),
          known.map((r) => r.id),
        );
        if (fresh) {
          let record = receive(fresh, new Date());
          if (activate(fresh.config)) {
            record = {
              ...record,
              activeLocally: true,
              audit: [...record.audit, { at: new Date().toISOString(), event: 'activated' }],
            };
          }
          record = await confirm(record);
          await collection.put(record.id, record);
          changed = true;
        }
        setLastCheck('ok');
      } else {
        setLastCheck('offline');
      }
      if (changed) await reload();
    } catch {
      setLastCheck('offline');
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }, [base, code, crewMember, confirm, reload]);

  // On mount, on link / mission / URL changes, and every minute while the screen is open.
  useEffect(() => {
    void reload();
    if (mission.linkDown) return;
    void check();
    const id = setInterval(() => void check(), POLL_MS);
    return () => clearInterval(id);
  }, [check, reload, mission.linkDown]);

  return { records, latest: latestReceived(records), check, checking, lastCheck };
}
