import type { Packet, Reading } from '../contracts';
import { gaussian, hashSeed, mulberry32 } from './prng';

export type EcgStrip = NonNullable<Packet['ecg']>;
export type EcgRhythm = 'sinus' | 'irregular';

export type EcgOptions = {
  seconds?: number;
  hz?: number;
  rhythm?: EcgRhythm;
  heartRate?: number;
  seed?: number;
};

const wave = (t: number, center: number, width: number, height: number) =>
  height * Math.exp(-(((t - center) / width) ** 2));

export function simulatedEcg(opts?: EcgOptions): EcgStrip {
  const seconds = Math.max(1, opts?.seconds ?? 10);
  const hz = Math.max(50, Math.round(opts?.hz ?? 250));
  const rhythm = opts?.rhythm ?? 'sinus';
  const heartRate = Math.min(220, Math.max(30, opts?.heartRate ?? 72));
  const rng = mulberry32(opts?.seed ?? 1);
  const meanRr = 60 / heartRate;

  const beats: { r: number; rr: number }[] = [];
  let t = meanRr * (0.3 + rng() * 0.4);
  while (t < seconds + meanRr) {
    const jitter = rhythm === 'irregular' ? (rng() - 0.5) * 0.7 : gaussian(rng, 0.03);
    const rr = Math.max(0.25, meanRr * (1 + jitter));
    beats.push({ r: t, rr });
    t += rr;
  }

  const fPhase = rng() * Math.PI * 2;
  const wanderPhase = rng() * Math.PI * 2;
  const microvolts = Array.from({ length: Math.round(seconds * hz) }, (_, i) => {
    const s = i / hz;
    let v = 0;
    for (const b of beats) {
      const d = s - b.r;
      if (d < -0.3 || d > 0.6) continue;
      const qt = Math.sqrt(b.rr);
      if (rhythm === 'sinus') v += wave(d, -0.16, 0.025, 120);
      v += wave(d, -0.025, 0.008, -150);
      v += wave(d, 0, 0.01, 1100);
      v += wave(d, 0.025, 0.008, -250);
      v += wave(d, 0.25 * qt, 0.045 * qt, 260);
    }
    if (rhythm === 'irregular') {
      v += 40 * Math.sin(2 * Math.PI * 6.3 * s + fPhase) + 25 * Math.sin(2 * Math.PI * 8.9 * s);
    }
    v += 30 * Math.sin(2 * Math.PI * 0.25 * s + wanderPhase);
    v += gaussian(rng, 8);
    return Math.round(v);
  });
  return { hz, microvolts };
}

export function ecgFromReadings(
  readings: Reading[],
  options?: Omit<EcgOptions, 'rhythm' | 'heartRate'> & { now?: Date; crewMember?: string },
): EcgStrip {
  const limit = options?.now?.getTime() ?? Number.POSITIVE_INFINITY;
  const latest = (indicator: string) =>
    readings
      .filter((r) => r.indicator === indicator && new Date(r.takenAt).getTime() <= limit)
      .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
      .at(-1);
  const rhythm: EcgRhythm = latest('heart-rhythm')?.value === 'irregular' ? 'irregular' : 'sinus';
  const hr = Number(latest('heart-rate')?.value);
  const when = options?.now ?? new Date(latest('heart-rate')?.takenAt ?? 0);
  return simulatedEcg({
    ...options,
    rhythm,
    heartRate: Number.isFinite(hr) ? hr : undefined,
    seed:
      options?.seed ??
      hashSeed(`${options?.crewMember ?? ''}:${Math.floor(when.getTime() / 60_000)}`),
  });
}
