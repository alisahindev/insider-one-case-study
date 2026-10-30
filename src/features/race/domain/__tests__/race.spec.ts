import { describe, expect, it } from 'vitest'
import { createRunners, distanceAt, finishTime, rankRunners, type Runner } from '../race'
import { createRng, type Rng } from '../random'
import type { Horse } from '../types'

const horse = (id: number, condition: number): Horse => ({
  id,
  name: `H${id}`,
  color: { name: 'c', hex: '#000000' },
  condition,
})
/** A runner with a perfectly even pace, so its times are easy to reason about. */
const steady = (horseId: number, baseSpeed: number): Runner => ({
  horseId,
  baseSpeed,
  surges: [],
  fatigue: 0,
})
// Every random draw lands mid-range, so daily form is exactly 1 and only condition differs.
const midpoint: Rng = () => 0.5

describe('createRunners', () => {
  it('creates one runner per horse, in the same order', () => {
    const runners = createRunners(createRng(1), [horse(7, 50), horse(3, 50), horse(9, 50)])
    expect(runners.map((r) => r.horseId)).toEqual([7, 3, 9])
  })

  it('returns no runners for no horses', () => {
    expect(createRunners(createRng(1), [])).toEqual([])
  })

  it('creates the same runners for the same seed', () => {
    const horses = [horse(1, 30), horse(2, 80)]
    expect(createRunners(createRng(4), horses)).toEqual(createRunners(createRng(4), horses))
  })

  it('gives fitter horses a faster base pace and less fatigue when form is equal', () => {
    const [weak, strong] = createRunners(midpoint, [horse(1, 1), horse(2, 100)])
    expect(strong!.baseSpeed).toBeGreaterThan(weak!.baseSpeed)
    expect(strong!.fatigue / strong!.baseSpeed).toBeLessThan(weak!.fatigue / weak!.baseSpeed)
  })

  it('gives every runner two surges and a positive pace', () => {
    for (const runner of createRunners(createRng(2), [horse(1, 1), horse(2, 100)])) {
      expect(runner.surges).toHaveLength(2)
      expect(runner.baseSpeed).toBeGreaterThan(0)
      expect(runner.fatigue).toBeGreaterThan(0)
    }
  })
})

describe('distanceAt', () => {
  const [runner] = createRunners(createRng(3), [horse(1, 50)])

  it('is 0 at the start and before it', () => {
    expect(distanceAt(runner!, 0)).toBe(0)
    expect(distanceAt(runner!, -5)).toBe(0)
  })

  it('only ever moves forward over the longest possible race', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const r of createRunners(createRng(seed), [horse(1, 1), horse(2, 50), horse(3, 100)])) {
        let previous = 0
        for (let t = 0.5; t <= 300; t += 0.5) {
          const d = distanceAt(r, t)
          expect(d).toBeGreaterThan(previous)
          previous = d
        }
      }
    }
  })

  it('equals pace times time for an even-paced runner', () => {
    expect(distanceAt(steady(1, 16), 10)).toBe(160)
  })
})

describe('finishTime', () => {
  const runners = createRunners(createRng(8), [horse(1, 1), horse(2, 50), horse(3, 100)])

  it.each([400, 1200, 1400, 1600, 1800, 2000, 2200, 3200])(
    'is the moment the runner reaches %i m',
    (distance) => {
      for (const runner of runners) {
        const time = finishTime(runner, distance)
        expect(distanceAt(runner, time)).toBeCloseTo(distance, 6)
        expect(distanceAt(runner, time - 0.001)).toBeLessThan(distance)
      }
    },
  )

  it('is exact for an even-paced runner', () => {
    expect(finishTime(steady(1, 16), 1600)).toBeCloseTo(100, 9)
  })

  it('is 0 for a distance of 0', () => {
    expect(finishTime(runners[0]!, 0)).toBe(0)
  })

  it('grows with the distance', () => {
    const times = [1200, 1400, 1600, 1800, 2000, 2200].map((d) => finishTime(runners[1]!, d))
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('produces realistic race times', () => {
    for (const runner of runners) {
      expect(finishTime(runner, 1200)).toBeGreaterThan(60)
      expect(finishTime(runner, 1200)).toBeLessThan(85)
    }
  })
})

describe('rankRunners', () => {
  it('orders runners from fastest to slowest', () => {
    const placings = rankRunners([steady(1, 16), steady(2, 18), steady(3, 17)], 1200)
    expect(placings.map((p) => p.horseId)).toEqual([2, 3, 1])
  })

  it('reports each runner with its own finish time', () => {
    const runners = createRunners(
      createRng(11),
      [1, 2, 3, 4].map((id) => horse(id, id * 20)),
    )
    for (const placing of rankRunners(runners, 1600)) {
      const runner = runners.find((r) => r.horseId === placing.horseId)!
      expect(placing.time).toBe(finishTime(runner, 1600))
    }
  })

  it('places every runner exactly once', () => {
    const runners = createRunners(
      createRng(12),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => horse(id, 50)),
    )
    const ids = rankRunners(runners, 2200).map((p) => p.horseId)
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('keeps the entry order for a dead heat', () => {
    const placings = rankRunners([steady(3, 16), steady(1, 16), steady(2, 16)], 1200)
    expect(placings.map((p) => p.horseId)).toEqual([3, 1, 2])
  })

  it('returns no placings for no runners', () => {
    expect(rankRunners([], 1200)).toEqual([])
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
