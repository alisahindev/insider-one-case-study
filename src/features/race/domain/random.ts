export type Rng = () => number

/** Mulberry32: tiny, fast, seedable PRNG so every race is reproducible from a seed. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Six-digit seeds stay short enough to read out and share. */
export function randomSeed(rng: Rng = Math.random): number {
  return Math.floor(rng() * 1_000_000)
}

/** Integer in [min, max], both inclusive. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function randomBetween(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

/** Picks `count` distinct items with a partial Fisher–Yates shuffle. */
export function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  const pool = [...items]
  const n = Math.max(0, Math.min(count, pool.length))
  for (let i = 0; i < n; i++) {
    const j = randomInt(rng, i, pool.length - 1)
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return pool.slice(0, n)
}
