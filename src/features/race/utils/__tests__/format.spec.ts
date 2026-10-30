import { describe, expect, it } from 'vitest'
import { HORSE_COLORS } from '../../domain/horses'
import { contrastColor, formatGap, formatRaceTime } from '../format'

const INK = '#14211A'
const WHITE = '#F7F7F2'

describe('formatRaceTime', () => {
  it.each([
    [73.418, '1:13.42'],
    [65.004, '1:05.00'],
    [9.5, '0:09.50'],
    [0, '0:00.00'],
    [0.005, '0:00.01'],
    [59.994, '0:59.99'],
    [600, '10:00.00'],
  ])('formats %f seconds as %s', (seconds, expected) => {
    expect(formatRaceTime(seconds)).toBe(expected)
  })

  it.each([
    [59.996, '1:00.00'],
    [119.999, '2:00.00'],
    [3599.999, '60:00.00'],
  ])('rounds %f up into the next minute as %s, never ":60.00"', (seconds, expected) => {
    expect(formatRaceTime(seconds)).toBe(expected)
  })
})

describe('formatGap', () => {
  it.each([
    [0.314, '+0.31'],
    [0, '+0.00'],
    [1.5, '+1.50'],
    [12.3, '+12.30'],
  ])('formats a gap of %f seconds as %s', (seconds, expected) => {
    expect(formatGap(seconds)).toBe(expected)
  })
})

describe('contrastColor', () => {
  it.each(['#FFFFFF', '#F5F5F0', '#F2C230', '#ffffff'])(
    'uses board ink on the light silk %s',
    (hex) => {
      expect(contrastColor(hex)).toBe(INK)
    },
  )

  it.each(['#000000', '#1B2A6B', '#C8102E', '#00FF00'])(
    'uses rail white on the dark silk %s',
    (hex) => {
      expect(contrastColor(hex)).toBe(WHITE)
    },
  )

  it('switches to ink only above 60% luminance', () => {
    expect(contrastColor('#999999')).toBe(WHITE)
    expect(contrastColor('#9A9A9A')).toBe(INK)
  })

  it('returns one of the two text colours for every silk in the palette', () => {
    for (const { hex } of HORSE_COLORS) expect([INK, WHITE]).toContain(contrastColor(hex))
  })
})
