import { CONDITION_MAX } from './config'
import { randomBetween, type Rng } from './random'
import type { Horse, Placing } from './types'

interface Surge {
  amplitude: number
  /** Angular frequency in rad/s. */
  frequency: number
  phase: number
}

/**
 * A horse's run as a closed-form speed curve: base pace, two slow surges and linear fatigue.
 * Position is an exact function of time, so the race is frame-rate independent and seekable.
 */
export interface Runner {
  horseId: number
  baseSpeed: number
  surges: Surge[]
  fatigue: number
}

// Condition sets the base pace; a ±4% daily form keeps upsets possible.
const MIN_PACE = 16 // m/s
const CONDITION_PACE_BONUS = 1.5 // m/s at full condition
const FORM_SPREAD = 0.04
const MAX_FATIGUE_PER_SECOND = 0.0006 // share of base speed lost each second at condition 0

export function createRunners(rng: Rng, horses: readonly Horse[]): Runner[] {
  return horses.map((horse) => {
    const fitness = horse.condition / CONDITION_MAX
    const form = randomBetween(rng, 1 - FORM_SPREAD, 1 + FORM_SPREAD)
    const baseSpeed = (MIN_PACE + CONDITION_PACE_BONUS * fitness) * form
    return {
      horseId: horse.id,
      baseSpeed,
      surges: [0, 1].map(() => ({
        amplitude: randomBetween(rng, 0.02, 0.06),
        frequency: randomBetween(rng, 0.05, 0.25),
        phase: randomBetween(rng, 0, Math.PI * 2),
      })),
      fatigue: baseSpeed * MAX_FATIGUE_PER_SECOND * (1 - fitness * 0.7),
    }
  })
}

/** Metres covered after `time` seconds (integral of the speed curve). */
export function distanceAt(runner: Runner, time: number): number {
  if (time <= 0) return 0
  const surge = runner.surges.reduce(
    (sum, s) =>
      sum +
      (s.amplitude / s.frequency) * (Math.cos(s.phase) - Math.cos(s.frequency * time + s.phase)),
    0,
  )
  return runner.baseSpeed * (time + surge) - (runner.fatigue * time * time) / 2
}

/** Time in seconds to cover `distance`. Speed stays positive over a race, so bisection is safe. */
export function finishTime(runner: Runner, distance: number): number {
  let low = 0
  let high = distance / (runner.baseSpeed * 0.5)
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2
    if (distanceAt(runner, mid) < distance) low = mid
    else high = mid
  }
  return high
}

export function rankRunners(runners: readonly Runner[], distance: number): Placing[] {
  return runners
    .map((runner) => ({ horseId: runner.horseId, time: finishTime(runner, distance) }))
    .sort((a, b) => a.time - b.time)
}
