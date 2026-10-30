import { describe, expect, it } from 'vitest'
import { createHorses } from '../horses'
import { createRng } from '../random'
import { createSchedule } from '../schedule'
import { DEFAULT_SETTINGS } from '../settings'

const stable = createHorses(createRng(5), 20)
const stableIds = new Set(stable.map((h) => h.id))

describe('createSchedule with the assignment defaults', () => {
  const schedule = createSchedule(
    createRng(9),
    stable,
    DEFAULT_SETTINGS.distances,
    DEFAULT_SETTINGS.horsesPerRound,
  )

  it('creates 6 rounds numbered 1 to 6', () => {
    expect(schedule.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('runs the rounds at 1200, 1400, 1600, 1800, 2000 and 2200 metres, in that order', () => {
    expect(schedule.map((r) => r.distance)).toEqual([1200, 1400, 1600, 1800, 2000, 2200])
  })

  it('enters 10 different horses from the stable in every round', () => {
    for (const round of schedule) {
      expect(new Set(round.horseIds).size).toBe(10)
      for (const id of round.horseIds) expect(stableIds.has(id)).toBe(true)
    }
  })

  it('draws a fresh field for each round', () => {
    const fields = new Set(schedule.map((r) => [...r.horseIds].sort().join()))
    expect(fields.size).toBeGreaterThan(1)
  })
})

describe('createSchedule with custom settings', () => {
  it('enters every horse once when a round asks for more horses than the stable has', () => {
    const [round] = createSchedule(createRng(1), stable.slice(0, 4), [1200], 10)
    expect([...round!.horseIds].sort()).toEqual([1, 2, 3, 4])
  })

  it('enters every horse when the round size equals the stable size', () => {
    const [round] = createSchedule(createRng(1), stable, [1200], 20)
    expect(new Set(round!.horseIds)).toEqual(stableIds)
  })

  it('keeps custom distances in the given order, even repeated ones', () => {
    const schedule = createSchedule(createRng(1), stable, [3200, 400, 400], 3)
    expect(schedule.map((r) => [r.number, r.distance])).toEqual([
      [1, 3200],
      [2, 400],
      [3, 400],
    ])
  })

  it('handles a single horse in a single round', () => {
    const [horse] = createHorses(createRng(1), 1)
    expect(createSchedule(createRng(1), [horse!], [400], 1)).toEqual([
      { number: 1, distance: 400, horseIds: [1] },
    ])
  })

  it('returns no rounds for no distances', () => {
    expect(createSchedule(createRng(1), stable, [], 10)).toEqual([])
  })

  it('creates the same program for the same seed', () => {
    const distances = DEFAULT_SETTINGS.distances
    expect(createSchedule(createRng(3), stable, distances, 10)).toEqual(
      createSchedule(createRng(3), stable, distances, 10),
    )
  })

  it('does not change the stable', () => {
    const before = structuredClone(stable)
    createSchedule(createRng(3), stable, DEFAULT_SETTINGS.distances, 10)
    expect(stable).toEqual(before)
  })
})
