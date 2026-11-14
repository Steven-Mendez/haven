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

export type StartupPhase = 'starting' | 'ready' | 'error';
let phase: StartupPhase = 'starting';
let promise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setPhase(next: StartupPhase) {
  phase = next;
  for (const fn of listeners) fn();
}

type StoredRules = { config?: Config; receivedAt?: string };

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
  } catch {}
}

function hideDevToolsButton() {
  if (!__DEV__) return;
  try {
    requireOptionalNativeModule<ExpoDevMenuModule>('ExpoDevMenu')?.setToolsButtonVisible?.(false);
  } catch {}
}

export function startServices(): Promise<void> {
  promise ??= (async () => {
    hideDevToolsButton();
    registerDevMenuEntry();
    try {
      await store.start();
      await applySavedRules();
      watch.start();
      setPhase('ready');
    } catch (error) {
      console.error('[startup] service startup failed', error);
      setPhase('error');
    }
  })();
  return promise;
}

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
