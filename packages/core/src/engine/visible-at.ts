import { MIN_MS } from './util';

export function computeVisibleAt(sentAt: string, delayMin: number, _demoFactor?: number): string {
  return new Date(new Date(sentAt).getTime() + delayMin * MIN_MS).toISOString();
}
