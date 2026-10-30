import { describe, expect, it } from 'vitest'
import {
  CONDITION_MAX,
  CONDITION_MIN,
  HORSE_COUNT,
  HORSES_PER_ROUND,
  ROUND_DISTANCES,
} from '../config'
import { createHorses } from '../horses'
import { createRunners, distanceAt, finishTime, rankRunners } from '../race'
import { createRng, randomInt, sample } from '../random'
import { createSchedule } from '../schedule'
import type { Horse } from '../types'

describe('random', () => {
  it('is reproducible for the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b))
  })

  it('keeps randomInt within inclusive bounds', () => {
    const rng = createRng(1)
    const values = Array.from({ length: 2000 }, () => randomInt(rng, 1, 3))
    expect(new Set(values)).toEqual(new Set([1, 2, 3]))
  })

  it('samples distinct items without mutating the source', () => {
    const items = [1, 2, 3, 4, 5]
    const picked = sample(createRng(7), items, 3)
    expect(new Set(picked).size).toBe(3)
    expect(items).toEqual([1, 2, 3, 4, 5])
  })
})

describe('createHorses', () => {
  const horses = createHorses(createRng(123))

  it('creates 20 horses with unique ids, names and colors', () => {
    expect(horses).toHaveLength(HORSE_COUNT)
    expect(new Set(horses.map((h) => h.id)).size).toBe(HORSE_COUNT)
    expect(new Set(horses.map((h) => h.name)).size).toBe(HORSE_COUNT)
    expect(new Set(horses.map((h) => h.color.hex)).size).toBe(HORSE_COUNT)
  })

  it('keeps condition between 1 and 100', () => {
    for (const { condition } of horses) {
      expect(condition).toBeGreaterThanOrEqual(CONDITION_MIN)
      expect(condition).toBeLessThanOrEqual(CONDITION_MAX)
    }
  })
})

describe('createSchedule', () => {
  const horses = createHorses(createRng(5))
  const schedule = createSchedule(createRng(9), horses)

  it('creates 6 rounds with the required distances in order', () => {
    expect(schedule.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6])
    expect(schedule.map((r) => r.distance)).toEqual([...ROUND_DISTANCES])
  })

  it('picks 10 distinct, existing horses per round', () => {
    const ids = new Set(horses.map((h) => h.id))
    for (const round of schedule) {
      expect(new Set(round.horseIds).size).toBe(HORSES_PER_ROUND)
      expect(round.horseIds.every((id) => ids.has(id))).toBe(true)
    }
  })
})

describe('race simulation', () => {
  const horse = (id: number, condition: number): Horse => ({
    id,
    name: `H${id}`,
    color: { name: 'c', hex: '#000' },
    condition,
  })

  it('always moves forward and finishes exactly at the distance', () => {
    const [runner] = createRunners(createRng(3), [horse(1, 1)])
    let previous = 0
    for (let t = 1; t <= 200; t++) {
      const d = distanceAt(runner!, t)
      expect(d).toBeGreaterThan(previous)
      previous = d
    }
    const time = finishTime(runner!, 2200)
    expect(distanceAt(runner!, time)).toBeCloseTo(2200, 3)
  })

  it('produces realistic race times', () => {
    const [runner] = createRunners(createRng(3), [horse(1, 50)])
    const time = finishTime(runner!, 1200)
    expect(time).toBeGreaterThan(60)
    expect(time).toBeLessThan(85)
  })

  it('ranks runners by finish time', () => {
    const runners = createRunners(
      createRng(11),
      [1, 2, 3, 4].map((id) => horse(id, id * 20)),
    )
    const placings = rankRunners(runners, 1600)
    const times = placings.map((p) => p.time)
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('favours fitter horses over many races without making them unbeatable', () => {
    let strongWins = 0
    for (let seed = 0; seed < 500; seed++) {
      const runners = createRunners(createRng(seed), [horse(1, 90), horse(2, 40)])
      if (rankRunners(runners, 1400)[0]!.horseId === 1) strongWins++
    }
    expect(strongWins).toBeGreaterThan(350)
    expect(strongWins).toBeLessThan(500)
  })
})
