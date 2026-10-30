import { CONDITION_MAX, CONDITION_MIN } from './config'
import { randomInt, sample, type Rng } from './random'
import type { Horse, HorseColor } from './types'

const NAMES = [
  'Kestrel',
  'Ember',
  'Nightjar',
  'Copperline',
  'Bramble',
  'Silver Arrow',
  'Monsoon',
  'Tidewater',
  'Cobalt Run',
  'Wildfire',
  'Juniper',
  'Marigold',
  'Northwind',
  'Pepper Jack',
  'Quicksilver',
  'Rosewood',
  'Stormchaser',
  'Velvet Thunder',
  'Wishbone',
  'Zephyr',
] as const

/** Hand-picked so all 20 stay distinguishable side by side on the track. */
export const HORSE_COLORS: readonly HorseColor[] = [
  { name: 'Crimson', hex: '#C8102E' },
  { name: 'Tangerine', hex: '#F26B1D' },
  { name: 'Saffron', hex: '#F2C230' },
  { name: 'Lime', hex: '#9BCB3C' },
  { name: 'Emerald', hex: '#128A4A' },
  { name: 'Teal', hex: '#0F8B8D' },
  { name: 'Sky', hex: '#4FB3E8' },
  { name: 'Royal', hex: '#2459C9' },
  { name: 'Navy', hex: '#1B2A6B' },
  { name: 'Violet', hex: '#6B3FA0' },
  { name: 'Orchid', hex: '#C45AB3' },
  { name: 'Rose', hex: '#F28AB2' },
  { name: 'Maroon', hex: '#7A1F2B' },
  { name: 'Chocolate', hex: '#6B4226' },
  { name: 'Tan', hex: '#C9A27A' },
  { name: 'Olive', hex: '#6E7B2C' },
  { name: 'Slate', hex: '#5B6B7A' },
  { name: 'Charcoal', hex: '#2B2B2B' },
  { name: 'Silver', hex: '#B8BEC6' },
  { name: 'Ivory', hex: '#F5F5F0' },
]

export function createHorses(rng: Rng, count: number): Horse[] {
  const names = sample(rng, NAMES, count)
  const colors = sample(rng, HORSE_COLORS, count)
  return names.map((name, i) => ({
    id: i + 1,
    name,
    color: colors[i]!,
    condition: randomInt(rng, CONDITION_MIN, CONDITION_MAX),
  }))
}
