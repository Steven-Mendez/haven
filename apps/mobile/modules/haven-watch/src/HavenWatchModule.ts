import { NativeModule, requireOptionalNativeModule } from 'expo';

export type HavenWatchEvents = {
  onMessage: (event: { json: string }) => void;
  onReachabilityChange: (event: { reachable: boolean }) => void;
};

export declare class HavenWatchModule extends NativeModule<HavenWatchEvents> {
  isAvailable(): boolean;
  isPaired(): boolean;
  isReachable(): boolean;
  send(json: string): void;
  updateContext(json: string): void;
}

/** null en Android, web o un build sin el módulo. */
export default requireOptionalNativeModule<HavenWatchModule>('HavenWatch');
