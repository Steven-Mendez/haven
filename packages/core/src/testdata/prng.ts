/** Deterministic PRNG (mulberry32). Same seed → same sequence on every platform. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** 32-bit FNV-1a hash of a string, used as a seed (e.g. crew member + indicator). */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Approximately normal noise (sum of 3 uniforms), mean 0 and standard deviation `sd`. */
export function gaussian(rng: () => number, sd: number): number {
  return (rng() + rng() + rng() - 1.5) * 2 * sd;
}
