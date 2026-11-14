import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { HavenWatchEvents } from './HavenWatch.types';

export declare class HavenWatchModule extends NativeModule<HavenWatchEvents> {
  /** WCSession supported and activated. */
  isAvailable(): boolean;
  /** isPaired && isWatchAppInstalled. */
  isPaired(): boolean;
  /** isReachable: the watch app is in the foreground and gets sendMessage immediately. */
  isReachable(): boolean;
  /** Sends a serialized WatchEnvelope. */
  send(json: string): void;
  /**
   * Emergency started on the phone: wakes the watch app (HKHealthStore.startWatchApp), which opens the patient
   * monitor. Resolves false when HealthKit or the watch app is unavailable.
   */
  startWatchMonitor(): Promise<boolean>;
}

/** null on Android, web, Expo Go or a build without the module: the phone then uses the watch simulator. */
export default requireOptionalNativeModule<HavenWatchModule>('HavenWatch');
