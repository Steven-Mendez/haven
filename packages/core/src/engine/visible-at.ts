import { MIN_MS } from './util';

/**
 * visibleAt = sentAt + delay (minutes). See M09 and T01. There is no artificial delay or demo factor:
 * the Earth API sets `visibleAt` to its receive time; this only expresses the mission delay as data.
 *
 * @param _demoFactor Deprecated and ignored (there is no demo factor any more). Kept only so existing
 * callers still compile; it will be removed.
 */
export function computeVisibleAt(sentAt: string, delayMin: number, _demoFactor?: number): string {
  return new Date(new Date(sentAt).getTime() + delayMin * MIN_MS).toISOString();
}
