import { HORSES_PER_ROUND, ROUND_DISTANCES } from './config'
import { sample, type Rng } from './random'
import type { Horse, Round } from './types'

export function createSchedule(rng: Rng, horses: readonly Horse[]): Round[] {
  const ids = horses.map((horse) => horse.id)
  return ROUND_DISTANCES.map((distance, i) => ({
    number: i + 1,
    distance,
    horseIds: sample(rng, ids, HORSES_PER_ROUND),
  }))
}
