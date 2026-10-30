import { describe, expect, it } from 'vitest'
import { LIMITS, SPEED_OPTIONS } from '../config'
import { DEFAULT_SETTINGS, fromQuery, normalizeSettings, type RaceSettings } from '../settings'

/** Every invariant the rest of the app relies on after normalisation. */
function expectValid(settings: RaceSettings) {
  const { horseCount, rounds, distance } = LIMITS
  expect(Number.isInteger(settings.horseCount)).toBe(true)
  expect(settings.horseCount).toBeGreaterThanOrEqual(horseCount.min)
  expect(settings.horseCount).toBeLessThanOrEqual(horseCount.max)
  expect(Number.isInteger(settings.horsesPerRound)).toBe(true)
  expect(settings.horsesPerRound).toBeGreaterThanOrEqual(1)
  expect(settings.horsesPerRound).toBeLessThanOrEqual(settings.horseCount)
  expect(settings.distances.length).toBeGreaterThanOrEqual(rounds.min)
  expect(settings.distances.length).toBeLessThanOrEqual(rounds.max)
  for (const d of settings.distances) {
    expect(d % distance.step).toBe(0)
    expect(d).toBeGreaterThanOrEqual(distance.min)
    expect(d).toBeLessThanOrEqual(distance.max)
  }
  expect(typeof settings.countdown).toBe('boolean')
  expect(SPEED_OPTIONS).toContain(settings.speed)
  const { seed } = settings
  expect(seed === null || (Number.isInteger(seed) && seed >= 0 && seed < 1_000_000)).toBe(true)
}

// Values that are not usable numbers; each must fall back instead of becoming 0.
const NOT_A_NUMBER = [
  null,
  undefined,
  '',
  '   ',
  'abc',
  '12abc',
  NaN,
  Infinity,
  -Infinity,
  true,
  false,
  [],
  [5],
  {},
]

describe('DEFAULT_SETTINGS', () => {
  it('follows the assignment: 20 horses, 10 per round, six rounds from 1200m to 2200m', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      horseCount: 20,
      horsesPerRound: 10,
      distances: [1200, 1400, 1600, 1800, 2000, 2200],
      countdown: true,
      speed: 1,
      seed: null,
    })
  })

  it('passes normalisation unchanged', () => {
    expect(normalizeSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS)
  })
})

describe('normalizeSettings', () => {
  it('returns the defaults for an empty object', () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid custom settings unchanged', () => {
    const custom: RaceSettings = {
      horseCount: 8,
      horsesPerRound: 4,
      distances: [400, 3200, 1000],
      countdown: false,
      speed: 4,
      seed: 123,
    }
    expect(normalizeSettings(custom)).toEqual(custom)
  })

  it('returns its own distances array, never the defaults one', () => {
    const result = normalizeSettings({})
    result.distances.push(400)
    expect(DEFAULT_SETTINGS.distances).toHaveLength(6)
  })

  it('gives the same result when run twice', () => {
    const once = normalizeSettings({
      horseCount: '7.6',
      horsesPerRound: 99,
      distances: [1, '1300'],
      seed: '5',
    })
    expect(normalizeSettings(once)).toEqual(once)
  })

  describe('horseCount', () => {
    it.each([
      [0, 1],
      [-5, 1],
      [21, 20],
      [1e9, 20],
      [7.4, 7],
      [7.5, 8],
      ['12', 12],
      [' 12 ', 12],
      ['1e1', 10],
    ])('turns %j into %i', (input, expected) => {
      expect(normalizeSettings({ horseCount: input }).horseCount).toBe(expected)
    })

    it.each(NOT_A_NUMBER)('falls back to 20 for %j', (input) => {
      expect(normalizeSettings({ horseCount: input }).horseCount).toBe(20)
    })
  })

  describe('horsesPerRound', () => {
    it('keeps a value within the stable size', () => {
      expect(normalizeSettings({ horseCount: 12, horsesPerRound: 7 }).horsesPerRound).toBe(7)
    })

    it('never asks for more runners than the stable has', () => {
      expect(normalizeSettings({ horseCount: 5, horsesPerRound: 10 }).horsesPerRound).toBe(5)
    })

    it('clamps the default of 10 to a smaller stable', () => {
      expect(normalizeSettings({ horseCount: 4 }).horsesPerRound).toBe(4)
    })

    it.each([0, -3])('raises %i to 1', (input) => {
      expect(normalizeSettings({ horsesPerRound: input }).horsesPerRound).toBe(1)
    })

    it.each(NOT_A_NUMBER)('falls back to 10 for %j', (input) => {
      expect(normalizeSettings({ horsesPerRound: input }).horsesPerRound).toBe(10)
    })
  })

  describe('distances', () => {
    it.each([
      [1299, 1200],
      [1300, 1400],
      [1301, 1400],
      [1100, 1200],
      [500, 600],
      ['1600', 1600],
    ])('snaps %j to the 200m grid as %i', (input, expected) => {
      expect(normalizeSettings({ distances: [input] }).distances).toEqual([expected])
    })

    it.each([
      [0, 400],
      [-1000, 400],
      [200, 400],
      [3300, 3200],
      [1e9, 3200],
    ])('clamps %j to %i', (input, expected) => {
      expect(normalizeSettings({ distances: [input] }).distances).toEqual([expected])
    })

    it.each(NOT_A_NUMBER)('replaces an unusable entry %j with 1200m', (input) => {
      expect(normalizeSettings({ distances: [input] }).distances).toEqual([1200])
    })

    it('keeps the round order and replaces only the bad entries', () => {
      expect(normalizeSettings({ distances: ['1200', 'abc', 2200] }).distances).toEqual([
        1200, 1200, 2200,
      ])
    })

    it('keeps at most 10 rounds', () => {
      const distances = Array.from({ length: 15 }, (_, i) => 400 + i * 200)
      expect(normalizeSettings({ distances }).distances).toEqual(distances.slice(0, 10))
    })

    it('falls back to the six default rounds for an empty list', () => {
      expect(normalizeSettings({ distances: [] }).distances).toEqual(DEFAULT_SETTINGS.distances)
    })

    it.each([null, '1200,1400', 1200, {}, { 0: 1200, length: 1 }])(
      'falls back to the six default rounds when given %j instead of a list',
      (input) => {
        expect(normalizeSettings({ distances: input }).distances).toEqual(
          DEFAULT_SETTINGS.distances,
        )
      },
    )
  })

  describe('countdown', () => {
    it.each([true, false])('keeps %j', (input) => {
      expect(normalizeSettings({ countdown: input }).countdown).toBe(input)
    })

    it.each(['false', 0, 1, null])('falls back to true for %j', (input) => {
      expect(normalizeSettings({ countdown: input }).countdown).toBe(true)
    })
  })

  describe('speed', () => {
    it.each(SPEED_OPTIONS)('keeps %ix', (input) => {
      expect(normalizeSettings({ speed: input }).speed).toBe(input)
    })

    it.each([0, 3, 8, '2', null, NaN])('falls back to 1x for %j', (input) => {
      expect(normalizeSettings({ speed: input }).speed).toBe(1)
    })
  })

  describe('seed', () => {
    it.each([
      [0, 0],
      [999_999, 999_999],
      [12.4, 12],
      ['42', 42],
      [' 7 ', 7],
    ])('keeps %j as %i', (input, expected) => {
      expect(normalizeSettings({ seed: input }).seed).toBe(expected)
    })

    it.each([-1, 1_000_000, 999_999.5, 1e12])('drops the out-of-range seed %j', (input) => {
      expect(normalizeSettings({ seed: input }).seed).toBeNull()
    })

    it('treats null as "no seed", not seed 0', () => {
      expect(normalizeSettings({ seed: null }).seed).toBeNull()
    })

    it.each(NOT_A_NUMBER)('treats %j as "no seed"', (input) => {
      expect(normalizeSettings({ seed: input }).seed).toBeNull()
    })
  })

  it.each([
    null,
    undefined,
    NaN,
    Infinity,
    '',
    'x',
    [],
    [[1]],
    {},
    true,
    -1e308,
    1e308,
    Symbol('s'),
    5n,
  ])('never throws and always returns valid settings when every field is %s', (value) => {
    const input = {
      horseCount: value,
      horsesPerRound: value,
      distances: value,
      countdown: value,
      speed: value,
      seed: value,
    }
    expect(() => normalizeSettings(input)).not.toThrow()
    expectValid(normalizeSettings(input))
  })

  it('never throws on hostile distance entries', () => {
    const settings = normalizeSettings({
      distances: [Symbol('d'), 5n, { valueOf: () => 800 }, [1600]],
    })
    expect(settings.distances).toEqual([1200, 1200, 1200, 1200])
  })
})

describe('fromQuery', () => {
  const query = (search: string) => fromQuery(new URLSearchParams(search))

  it('returns null without a seed, so saved settings are used instead', () => {
    expect(query('')).toBeNull()
    expect(query('horses=5&perRound=3&distances=400')).toBeNull()
  })

  it('uses the defaults for everything except the seed', () => {
    expect(query('seed=42')).toEqual({ ...DEFAULT_SETTINGS, seed: 42 })
  })

  it('reads horses, runners per round and distances', () => {
    expect(query('seed=42&horses=8&perRound=4&distances=400,800,3200')).toEqual({
      ...DEFAULT_SETTINGS,
      horseCount: 8,
      horsesPerRound: 4,
      distances: [400, 800, 3200],
      seed: 42,
    })
  })

  it('clamps runners per round to a smaller stable when only horses is given', () => {
    expect(query('seed=1&horses=5')).toMatchObject({ horseCount: 5, horsesPerRound: 5 })
  })

  it('does not take playback preferences from the link', () => {
    expect(query('seed=1&speed=4&countdown=false')).toMatchObject({ speed: 1, countdown: true })
  })

  it('turns garbage values into valid settings and drops empty distance entries', () => {
    expect(query('seed=abc&horses=lots&perRound=-3&distances=x,,1300')).toEqual({
      ...DEFAULT_SETTINGS,
      horsesPerRound: 1,
      distances: [1200, 1400],
      seed: null,
    })
  })

  it('treats an empty seed as a random race day', () => {
    expect(query('seed=')).toEqual(DEFAULT_SETTINGS)
  })

  it('treats empty horse and runner counts as missing', () => {
    expect(query('seed=1&horses=&perRound=')).toMatchObject({ horseCount: 20, horsesPerRound: 10 })
  })

  it('drops a seed outside 0 to 999999', () => {
    expect(query('seed=1000000')?.seed).toBeNull()
  })

  it('treats an empty distances parameter as missing and keeps the default six rounds', () => {
    expect(query('seed=1&distances=')?.distances).toEqual(DEFAULT_SETTINGS.distances)
  })
})
