export const CONDITION_MIN = 1
export const CONDITION_MAX = 100

/** Seconds of countdown before each round starts. */
export const COUNTDOWN_SECONDS = 3

export const SPEED_OPTIONS = [1, 2, 4] as const
export type Speed = (typeof SPEED_OPTIONS)[number]

/** Bounds for everything a user can customise on the setup screen. */
export const LIMITS = {
  horseCount: { min: 1, max: 20 }, // one unique colour per horse
  rounds: { min: 1, max: 10 },
  distance: { min: 400, max: 3200, step: 200 },
} as const
