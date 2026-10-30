import { describe, expect, it } from 'vitest'
import { contrastColor, formatGap, formatRaceTime } from '../format'

describe('format', () => {
  it('formats race times as m:ss.cc', () => {
    expect(formatRaceTime(73.418)).toBe('1:13.42')
    expect(formatRaceTime(65.004)).toBe('1:05.00')
    expect(formatRaceTime(9.5)).toBe('0:09.50')
  })

  it('formats gaps behind the winner', () => {
    expect(formatGap(0.314)).toBe('+0.31')
  })

  it('picks readable text for light and dark silks', () => {
    expect(contrastColor('#F5F5F0')).toBe('#14211A')
    expect(contrastColor('#1B2A6B')).toBe('#F7F7F2')
  })
})
