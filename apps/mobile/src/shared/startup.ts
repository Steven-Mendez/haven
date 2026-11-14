import type { Config } from '@haven/core';
import { requireOptionalNativeModule } from 'expo';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { setActiveConfig } from '@/shared/config';
import { store } from '@/shared/data';
import { db } from '@/shared/db';
import { bus } from '@/shared/events';
import { currentLanguage } from '@/shared/i18n';
import { navigationTexts } from '@/shared/i18n/navigation';
import { watch } from '@/shared/watch';

// Mobile service startup (M00): db → data → saved Earth rules → watch. Called by the root layout.
// Real health providers (HealthKit…) are started by M07 from the root layout once data is ready.

export type StartupPhase = 'starting' | 'ready' | 'error';
let phase: StartupPhase = 'starting';
let promise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setPhase(next: StartupPhase) {
  phase = next;
  for (const fn of listeners) fn();
}

/** Minimal shape of M05's `ReceivedRules` records in `db.collection('rules')`. */
type StoredRules = { config?: Config; receivedAt?: string };

/** Re-applies the last rules received from Earth, so they stay active after a restart. */
async function applySavedRules() {
  try {
    const records = await db.collection<StoredRules>('rules').all();
    const latest = records
      .filter((r) => r.config && Array.isArray(r.config.indicators) && r.receivedAt)
      .sort((a, b) => (a.receivedAt as string).localeCompare(b.receivedAt as string))
      .at(-1);
    if (latest?.config) setActiveConfig(latest.config);
  } catch (error) {
    console.warn('[startup] could not apply the saved Earth rules', error);
  }
}

type ExpoDevMenuModule = {
  setToolsButtonVisible?: (visible: boolean) => void;
  addDevMenuCallbacks?: (callbacks: { name: string; shouldCollapse?: boolean }[]) => Promise<void>;
};

/**
 * Development builds only: adds «HAVEN developer panel» to the Expo dev menu (shake / ⌘D), the way
 * to open `/dev` (the main screen has no visible shortcut). `haven://dev` also works.
 */
function registerDevMenuEntry() {
  if (!__DEV__) return;
  const devMenu = requireOptionalNativeModule<ExpoDevMenuModule>('ExpoDevMenu');
  if (!devMenu?.addDevMenuCallbacks) return;
  const name = navigationTexts[currentLanguage()].devMenuItem;
  try {
    void devMenu.addDevMenuCallbacks([{ name, shouldCollapse: true }]);
    DeviceEventEmitter.addListener('registeredCallbackFired', (fired: string) => {
      if (fired === name) router.push('/dev');
    });
  } catch {
    // Not a development client build.
  }
}

/**
 * Hides the expo-dev-client floating tools button (gear), which covers the top-right corner of
 * our headers (DESIGN_SYSTEM §8.10). Development builds only; the menu stays on shake / ⌘D.
 */
function hideDevToolsButton() {
  if (!__DEV__) return;
  try {
    requireOptionalNativeModule<ExpoDevMenuModule>('ExpoDevMenu')?.setToolsButtonVisible?.(false);
  } catch {
    // Older dev client or not a development build: nothing to hide.
  }
}

export function startServices(): Promise<void> {
  promise ??= (async () => {
    hideDevToolsButton();
    registerDevMenuEntry();
    try {
      await store.start(); // opens the db, migrates, loads, seeds and evaluates
      await applySavedRules(); // re-evaluates through onConfigChange
      watch.start();
      setPhase('ready');
    } catch (error) {
      console.error('[startup] service startup failed', error);
      setPhase('error');
    }
  })();
  return promise;
}

/** Starts the services once and returns the phase. */
export function useStartup(): StartupPhase {
  useEffect(() => {
    void startServices();
  }, []);
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => phase,
    () => phase,
  );
}

/**
 * Global 'emergency:open' listener: whether it comes from the button, the watch, a notification
 * or a red assessment, it opens /emergency (unless it is already open).
 */
export function useEmergencyListener() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  useEffect(
    () =>
      bus.on('emergency:open', ({ origin }) => {
        if (pathRef.current !== '/emergency') {
          router.push({ pathname: '/emergency', params: { origin } });
        }
      }),
    [],
  );
}
