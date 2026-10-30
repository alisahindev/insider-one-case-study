import { sample, type Rng } from './random'
import type { Horse, Round } from './types'

export function createSchedule(
  rng: Rng,
  horses: readonly Horse[],
  distances: readonly number[],
  horsesPerRound: number,
): Round[] {
  const ids = horses.map((horse) => horse.id)
  return distances.map((distance, i) => ({
    number: i + 1,
    distance,
    horseIds: sample(rng, ids, horsesPerRound),
  }))
}
