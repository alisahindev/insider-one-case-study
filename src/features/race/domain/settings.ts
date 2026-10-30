import { LIMITS, SPEED_OPTIONS, type Speed } from './config'

export interface RaceSettings {
  horseCount: number
  horsesPerRound: number
  /** One entry per round, in metres. */
  distances: number[]
  countdown: boolean
  speed: Speed
  /** Fixed seed to replay a race day; null draws a fresh one every time. */
  seed: number | null
}

/** The assignment's rules: 20 horses, 10 per round, six rounds from 1200m to 2200m. */
export const DEFAULT_SETTINGS: RaceSettings = {
  horseCount: 20,
  horsesPerRound: 10,
  distances: [1200, 1400, 1600, 1800, 2000, 2200],
  countdown: true,
  speed: 1,
  seed: null,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
// Only numbers and numeric strings count: Number(null), Number('') and Number([]) are all 0,
// which would turn a missing seed into seed 0 and replay the same day forever.
const toInt = (value: unknown, fallback: number) => {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) {
    return fallback
  }
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number) : fallback
}

/**
 * Turns untrusted input (URL, localStorage, form state) into valid settings:
 * every number is clamped, distances snap to the 200m grid, missing fields fall back to defaults.
 */
export function normalizeSettings(
  input: Partial<Record<keyof RaceSettings, unknown>>,
): RaceSettings {
  const { horseCount, distance, rounds } = LIMITS
  const horses = clamp(
    toInt(input.horseCount, DEFAULT_SETTINGS.horseCount),
    horseCount.min,
    horseCount.max,
  )
  const rawDistances = Array.isArray(input.distances) ? input.distances : DEFAULT_SETTINGS.distances
  const distances = rawDistances
    .slice(0, rounds.max)
    .map((d) =>
      clamp(Math.round(toInt(d, 1200) / distance.step) * distance.step, distance.min, distance.max),
    )
  const seed = toInt(input.seed, -1)

  return {
    horseCount: horses,
    horsesPerRound: clamp(toInt(input.horsesPerRound, DEFAULT_SETTINGS.horsesPerRound), 1, horses),
    distances: distances.length ? distances : [...DEFAULT_SETTINGS.distances],
    countdown: typeof input.countdown === 'boolean' ? input.countdown : DEFAULT_SETTINGS.countdown,
    speed: SPEED_OPTIONS.includes(input.speed as Speed)
      ? (input.speed as Speed)
      : DEFAULT_SETTINGS.speed,
    seed: seed >= 0 && seed < 1_000_000 ? seed : null,
  }
}

/** Deep link (`?seed=…&horses=…`) that opens a specific race day; also keeps E2E tests deterministic. */
export function fromQuery(params: URLSearchParams): RaceSettings | null {
  if (!params.has('seed')) return null
  return normalizeSettings({
    seed: params.get('seed'),
    horseCount: params.get('horses') ?? undefined,
    horsesPerRound: params.get('perRound') ?? undefined,
    distances: params.get('distances')?.split(','),
  })
}
