import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOUR_STEPS } from '../../steps'
import { useTourStore } from '../tour'

const KEY = '1nsider:tour-seen'
const LAST = TOUR_STEPS.length - 1

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('tour store', () => {
  it('starts closed', () => {
    expect(useTourStore().step).toBeNull()
  })

  it('opens on the first step', () => {
    const tour = useTourStore()
    tour.start()
    expect(tour.step).toBe(0)
  })

  it('restarts from the first step when opened again mid-tour', () => {
    const tour = useTourStore()
    tour.start()
    tour.next()
    tour.start()
    expect(tour.step).toBe(0)
  })

  describe('startIfNew', () => {
    it('opens the tour on a first visit', () => {
      const tour = useTourStore()
      tour.startIfNew()
      expect(tour.step).toBe(0)
    })

    it('stays closed once the tour has been seen', () => {
      localStorage.setItem(KEY, '1')
      const tour = useTourStore()
      tour.startIfNew()
      expect(tour.step).toBeNull()
    })

    it.each(['0', 'true', ''])('opens the tour when the seen flag holds %j', (value) => {
      localStorage.setItem(KEY, value)
      const tour = useTourStore()
      tour.startIfNew()
      expect(tour.step).toBe(0)
    })

    it('opens the tour when storage cannot be read', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError')
      })
      const tour = useTourStore()
      tour.startIfNew()
      expect(tour.step).toBe(0)
    })
  })

  describe('next', () => {
    it('advances one step', () => {
      const tour = useTourStore()
      tour.start()
      tour.next()
      expect(tour.step).toBe(1)
    })

    it('walks through every step in order', () => {
      const tour = useTourStore()
      tour.start()
      const visited = [tour.step]
      for (let i = 0; i < LAST; i++) {
        tour.next()
        visited.push(tour.step)
      }
      expect(visited).toEqual(TOUR_STEPS.map((_, i) => i))
    })

    it('closes the tour and remembers it after the last step', () => {
      const tour = useTourStore()
      tour.start()
      for (let i = 0; i < LAST; i++) tour.next()
      tour.next()
      expect(tour.step).toBeNull()
      expect(localStorage.getItem(KEY)).toBe('1')
    })

    it('does nothing while the tour is closed', () => {
      const tour = useTourStore()
      tour.next()
      expect(tour.step).toBeNull()
      expect(localStorage.getItem(KEY)).toBeNull()
    })
  })

  describe('back', () => {
    it('goes back one step', () => {
      const tour = useTourStore()
      tour.start()
      tour.next()
      tour.next()
      tour.back()
      expect(tour.step).toBe(1)
    })

    it('stays on the first step', () => {
      const tour = useTourStore()
      tour.start()
      tour.back()
      expect(tour.step).toBe(0)
    })

    it('does nothing while the tour is closed', () => {
      const tour = useTourStore()
      tour.back()
      expect(tour.step).toBeNull()
    })
  })

  describe('close', () => {
    it('closes the tour from any step and remembers it was seen', () => {
      const tour = useTourStore()
      tour.start()
      tour.next()
      tour.close()
      expect(tour.step).toBeNull()
      expect(localStorage.getItem(KEY)).toBe('1')
    })

    it('keeps the tour closed on the next visit', () => {
      useTourStore().close()
      setActivePinia(createPinia())
      const tour = useTourStore()
      tour.startIfNew()
      expect(tour.step).toBeNull()
    })

    it('still closes when storage cannot be written', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
      const tour = useTourStore()
      tour.start()
      expect(() => tour.close()).not.toThrow()
      expect(tour.step).toBeNull()
    })
  })
})
