import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type RaceSettings } from '../../domain/settings'
import { useRaceStore } from '../race'
import { useSettingsStore } from '../settings'

const KEY = '1nsider:settings'
const custom: RaceSettings = {
  horseCount: 8,
  horsesPerRound: 4,
  distances: [400, 1000, 3200],
  countdown: false,
  speed: 2,
  seed: 4242,
}

/** A fresh store as on a new visit, reading whatever is in storage now. */
function reload() {
  setActivePinia(createPinia())
  return useSettingsStore()
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('settings store', () => {
  it('starts with the assignment defaults and the setup dialog closed', () => {
    const store = useSettingsStore()
    expect(store.settings).toEqual(DEFAULT_SETTINGS)
    expect(store.isSetupOpen).toBe(false)
  })

  it('opens and closes the setup dialog', () => {
    const store = useSettingsStore()
    store.isSetupOpen = true
    expect(store.isSetupOpen).toBe(true)
    store.isSetupOpen = false
    expect(store.isSetupOpen).toBe(false)
  })

  it('applies saved settings straight away', () => {
    const store = useSettingsStore()
    store.save(custom)
    expect(store.settings).toEqual(custom)
  })

  it('persists saved settings without the seed', () => {
    useSettingsStore().save(custom)
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ ...custom, seed: null })
  })

  it('restores saved settings on the next visit, without the seed', () => {
    useSettingsStore().save(custom)
    expect(reload().settings).toEqual({ ...custom, seed: null })
  })

  it('lets the next race day draw a random seed after a reload', () => {
    useSettingsStore().save(custom)
    const settings = reload().settings
    const race = useRaceStore()
    vi.spyOn(Math, 'random').mockReturnValue(0.654321)
    race.newRaceDay(settings)
    expect(race.seed).toBe(654321)
  })

  it('ignores a seed written into storage by hand', () => {
    localStorage.setItem(KEY, JSON.stringify({ ...custom, seed: 42 }))
    expect(reload().settings.seed).toBeNull()
  })

  it('clamps out-of-range stored values', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ horseCount: 99, horsesPerRound: 50, distances: [100, 1300, 9999] }),
    )
    expect(reload().settings).toMatchObject({
      horseCount: 20,
      horsesPerRound: 20,
      distances: [400, 1400, 3200],
    })
  })

  it('fills in fields missing from storage with the defaults', () => {
    localStorage.setItem(KEY, JSON.stringify({ horseCount: 6 }))
    expect(reload().settings).toEqual({ ...DEFAULT_SETTINGS, horseCount: 6, horsesPerRound: 6 })
  })

  it('falls back to the defaults for corrupted JSON', () => {
    localStorage.setItem(KEY, '{not json')
    expect(reload().settings).toEqual(DEFAULT_SETTINGS)
  })

  it.each(['null', '5', '"text"', '[1, 2]', 'true'])(
    'falls back to the defaults for %s',
    (saved) => {
      localStorage.setItem(KEY, saved)
      expect(reload().settings).toEqual(DEFAULT_SETTINGS)
    },
  )

  it('falls back to the defaults when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(reload().settings).toEqual(DEFAULT_SETTINGS)
  })

  it('still applies settings when storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const store = useSettingsStore()
    expect(() => store.save(custom)).not.toThrow()
    expect(store.settings).toEqual(custom)
  })
})
