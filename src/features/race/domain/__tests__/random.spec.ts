import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRng, randomBetween, randomInt, randomSeed, sample, type Rng } from '../random'

const constant =
  (value: number): Rng =>
  () =>
    value
const draw = (rng: Rng, count: number) => Array.from({ length: count }, () => rng())

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createRng', () => {
  it('returns the same sequence for the same seed', () => {
    expect(draw(createRng(42), 10)).toEqual(draw(createRng(42), 10))
  })

  it('returns different sequences for different seeds', () => {
    expect(draw(createRng(1), 10)).not.toEqual(draw(createRng(2), 10))
  })

  it('keeps producing the published sequence, so shared seeds replay the same race day', () => {
    expect(draw(createRng(42), 3)).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
    ])
  })

  it('only returns values in [0, 1)', () => {
    for (const value of draw(createRng(7), 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('wraps any number to an unsigned 32-bit seed', () => {
    expect(draw(createRng(-1), 3)).toEqual(draw(createRng(2 ** 32 - 1), 3))
    expect(draw(createRng(1.9), 3)).toEqual(draw(createRng(1), 3))
  })
})

describe('randomSeed', () => {
  it('uses Math.random by default', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456)
    expect(randomSeed()).toBe(123456)
  })

  it('stays within 0 to 999999', () => {
    expect(randomSeed(constant(0))).toBe(0)
    expect(randomSeed(constant(0.9999999999))).toBe(999_999)
  })

  it('is deterministic for a seeded generator', () => {
    expect(randomSeed(createRng(5))).toBe(randomSeed(createRng(5)))
  })

  it('always returns a whole number', () => {
    const rng = createRng(3)
    for (let i = 0; i < 1000; i++) expect(Number.isInteger(randomSeed(rng))).toBe(true)
  })
})

describe('randomInt', () => {
  it('includes both bounds', () => {
    expect(randomInt(constant(0), 1, 100)).toBe(1)
    expect(randomInt(constant(0.9999999999), 1, 100)).toBe(100)
  })

  it('returns min when min equals max', () => {
    expect(randomInt(createRng(1), 5, 5)).toBe(5)
  })

  it('reaches every value in the range and nothing outside it', () => {
    const rng = createRng(1)
    const values = new Set(Array.from({ length: 2000 }, () => randomInt(rng, 1, 3)))
    expect(values).toEqual(new Set([1, 2, 3]))
  })
})

describe('randomBetween', () => {
  it('starts at min and scales linearly towards max', () => {
    expect(randomBetween(constant(0), 2, 6)).toBe(2)
    expect(randomBetween(constant(0.5), 2, 6)).toBe(4)
  })

  it('never reaches max', () => {
    const rng = createRng(9)
    for (let i = 0; i < 1000; i++) expect(randomBetween(rng, 0.02, 0.06)).toBeLessThan(0.06)
  })
})

describe('sample', () => {
  const items = ['a', 'b', 'c', 'd', 'e'] as const

  it('picks the requested number of distinct items from the source', () => {
    const picked = sample(createRng(7), items, 3)
    expect(picked).toHaveLength(3)
    expect(new Set(picked).size).toBe(3)
    for (const item of picked) expect(items).toContain(item)
  })

  it('returns a permutation of every item when count equals the length', () => {
    expect([...sample(createRng(7), items, 5)].sort()).toEqual([...items])
  })

  it('caps the result at the number of items when count is larger', () => {
    expect([...sample(createRng(7), items, 50)].sort()).toEqual([...items])
  })

  it('returns nothing for a count of 0 or an empty source', () => {
    expect(sample(createRng(7), items, 0)).toEqual([])
    expect(sample(createRng(7), [], 3)).toEqual([])
  })

  it('does not mutate the source', () => {
    const source = [1, 2, 3, 4, 5]
    sample(createRng(7), source, 5)
    expect(source).toEqual([1, 2, 3, 4, 5])
  })

  it('is deterministic for a seed', () => {
    expect(sample(createRng(11), items, 4)).toEqual(sample(createRng(11), items, 4))
  })

  it('can put any item first', () => {
    const firsts = new Set(
      Array.from({ length: 500 }, (_, seed) => sample(createRng(seed), items, 1)[0]),
    )
    expect(firsts).toEqual(new Set(items))
  })

  // Guards against slice(0, -1), which would drop only the last item.
  it('returns nothing for a negative count', () => {
    expect(sample(createRng(7), items, -1)).toEqual([])
  })
})
