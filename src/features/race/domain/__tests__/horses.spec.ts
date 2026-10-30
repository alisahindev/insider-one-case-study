import { describe, expect, it } from 'vitest'
import { CONDITION_MAX, CONDITION_MIN, LIMITS } from '../config'
import { createHorses, HORSE_COLORS } from '../horses'
import { createRng } from '../random'

describe('HORSE_COLORS', () => {
  it('has one colour for every horse the stable can hold', () => {
    expect(HORSE_COLORS).toHaveLength(LIMITS.horseCount.max)
  })

  it('has unique names and hex values', () => {
    expect(new Set(HORSE_COLORS.map((c) => c.name)).size).toBe(HORSE_COLORS.length)
    expect(new Set(HORSE_COLORS.map((c) => c.hex.toLowerCase())).size).toBe(HORSE_COLORS.length)
  })

  it('uses six-digit hex values', () => {
    for (const { hex } of HORSE_COLORS) expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('createHorses', () => {
  it.each([1, 5, 10, 20])('creates exactly %i horses', (count) => {
    expect(createHorses(createRng(1), count)).toHaveLength(count)
  })

  it('numbers horses from 1 upwards', () => {
    expect(createHorses(createRng(1), 6).map((h) => h.id)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('gives every horse in a full stable a unique name and colour', () => {
    const horses = createHorses(createRng(123), 20)
    expect(new Set(horses.map((h) => h.name)).size).toBe(20)
    expect(new Set(horses.map((h) => h.color.hex)).size).toBe(20)
  })

  it('only uses colours from the palette', () => {
    for (const horse of createHorses(createRng(4), 20)) expect(HORSE_COLORS).toContain(horse.color)
  })

  it('gives every horse a non-empty name', () => {
    for (const horse of createHorses(createRng(4), 20)) expect(horse.name.trim()).not.toBe('')
  })

  it('keeps condition a whole number from 1 to 100', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const { condition } of createHorses(createRng(seed), 20)) {
        expect(Number.isInteger(condition)).toBe(true)
        expect(condition).toBeGreaterThanOrEqual(CONDITION_MIN)
        expect(condition).toBeLessThanOrEqual(CONDITION_MAX)
      }
    }
  })

  it('can draw both ends of the condition range', () => {
    const conditions = Array.from({ length: 200 }, (_, seed) =>
      createHorses(createRng(seed), 20).map((h) => h.condition),
    ).flat()
    expect(Math.min(...conditions)).toBe(CONDITION_MIN)
    expect(Math.max(...conditions)).toBe(CONDITION_MAX)
  })

  it('creates the same stable for the same seed', () => {
    expect(createHorses(createRng(99), 20)).toEqual(createHorses(createRng(99), 20))
  })

  it('creates a different stable for a different seed', () => {
    expect(createHorses(createRng(1), 20)).not.toEqual(createHorses(createRng(2), 20))
  })

  it('returns no horses for a count of 0', () => {
    expect(createHorses(createRng(1), 0)).toEqual([])
  })

  it('caps the stable at 20 horses, one per colour', () => {
    expect(createHorses(createRng(1), 25)).toHaveLength(20)
  })
})
