export type Rng = () => number;

/** Deterministic, fast PRNG. Seeded so drills/tests are reproducible. */
export function mulberry32(seed: number): Rng {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive integer in [min, max]. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * A default RNG for live play. We avoid Math.random directly only where
 * reproducibility matters; here entropy is fine, so seed from performance time.
 */
export function makeLiveRng(): Rng {
  const seed = Math.floor((typeof performance !== 'undefined' ? performance.now() : 0) * 1000) ^ 0x9e3779b9;
  return mulberry32(seed >>> 0 || 1);
}
