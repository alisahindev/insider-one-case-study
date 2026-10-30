export interface HorseColor {
  name: string
  hex: string
}

export interface Horse {
  id: number
  name: string
  color: HorseColor
  /** Fitness from CONDITION_MIN to CONDITION_MAX; higher runs faster on average. */
  condition: number
}

export interface Round {
  /** 1-based, matches how the round is shown to users. */
  number: number
  distance: number
  horseIds: number[]
}

export interface Placing {
  horseId: number
  /** Race time in seconds. */
  time: number
}

export interface RoundResult {
  roundNumber: number
  distance: number
  placings: Placing[]
}
