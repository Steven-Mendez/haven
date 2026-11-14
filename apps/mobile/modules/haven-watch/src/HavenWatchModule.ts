import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { HavenWatchEvents } from './HavenWatch.types';

export declare class HavenWatchModule extends NativeModule<HavenWatchEvents> {
  isAvailable(): boolean;
  isPaired(): boolean;
  isReachable(): boolean;
  send(json: string): void;
  startWatchMonitor(): Promise<boolean>;
}

export default requireOptionalNativeModule<HavenWatchModule>('HavenWatch');
