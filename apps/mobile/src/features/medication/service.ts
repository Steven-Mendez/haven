import { medications } from '@haven/core';
import { AppState } from 'react-native';
import { store } from '@/shared/data';
import { currentCrew, loadPlan, savePlan } from '@/shared/plan';
import { parsePlanResponse } from './logic/plan';

const POLL_MS = 60_000;
const TIMEOUT_MS = 8_000;
let started = false;

/** Downloads the plan Earth assigned; keeps the last one when offline. */
export async function syncPlan(): Promise<void> {
  const { joined, apiUrl } = store.preferences();
  const base = apiUrl?.trim().replace(/\/+$/, '');
  if (!joined || !base || store.mission().linkDown) {
    await loadPlan();
    return;
  }
  const who = currentCrew();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const query = `mission=${encodeURIComponent(who.mission)}&crewMember=${encodeURIComponent(who.crewMember)}`;
    const response = await fetch(`${base}/api/plan?${query}`, { signal: controller.signal });
    const plan = response.ok
      ? parsePlanResponse(await response.json(), who, medications)
      : undefined;
    if (plan) {
      await savePlan(plan);
      return;
    }
  } catch {
    // Offline: the stored plan stays in use.
  } finally {
    clearTimeout(timer);
  }
  await loadPlan();
}

export function startPlanSync() {
  if (started) return;
  started = true;
  const sync = () => {
    syncPlan().catch((error) => console.warn('[medication] plan sync failed', error));
  };
  sync();
  setInterval(sync, POLL_MS);
  AppState.addEventListener('change', (state) => {
    if (state === 'active') sync();
  });
  // A new mission or crew member needs its own plan right away, not on the next poll.
  let who = `${store.mission().code}/${store.preferences().crewMember}`;
  const onChange = () => {
    const next = `${store.mission().code}/${store.preferences().crewMember}`;
    if (next === who) return;
    who = next;
    sync();
  };
  store.subscribe('preferences', onChange);
  store.subscribe('mission', onChange);
}
