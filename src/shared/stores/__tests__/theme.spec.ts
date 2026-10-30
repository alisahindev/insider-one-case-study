import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { THEMES, useThemeStore } from '../theme'

const KEY = '1nsider:theme'
const root = document.documentElement

beforeEach(() => {
  localStorage.clear()
  delete root.dataset.theme
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('theme store', () => {
  it('offers system, light and dark', () => {
    expect(THEMES).toEqual(['system', 'light', 'dark'])
  })

  it('follows the system by default, leaving data-theme unset', () => {
    expect(useThemeStore().theme).toBe('system')
    expect(root.dataset.theme).toBeUndefined()
  })

  it.each(['light', 'dark'] as const)(
    'restores a saved %s theme and applies it at once',
    (theme) => {
      localStorage.setItem(KEY, theme)
      expect(useThemeStore().theme).toBe(theme)
      expect(root.dataset.theme).toBe(theme)
    },
  )

  it.each(['purple', '', 'DARK', 'null'])('ignores the unknown saved value %j', (value) => {
    localStorage.setItem(KEY, value)
    expect(useThemeStore().theme).toBe('system')
    expect(root.dataset.theme).toBeUndefined()
  })

  it('applies and saves a newly chosen theme', async () => {
    const store = useThemeStore()
    store.theme = 'dark'
    await nextTick()
    expect(root.dataset.theme).toBe('dark')
    expect(localStorage.getItem(KEY)).toBe('dark')
  })

  it('removes data-theme when switching back to system', async () => {
    localStorage.setItem(KEY, 'light')
    const store = useThemeStore()
    store.theme = 'system'
    await nextTick()
    expect(root.dataset.theme).toBeUndefined()
    expect(localStorage.getItem(KEY)).toBe('system')
  })

  it('restores the chosen theme on the next visit', async () => {
    useThemeStore().theme = 'light'
    await nextTick()
    setActivePinia(createPinia())
    expect(useThemeStore().theme).toBe('light')
  })

  it('follows the system when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(useThemeStore().theme).toBe('system')
  })

  it('still applies the theme when storage cannot be written', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const store = useThemeStore()
    store.theme = 'dark'
    await nextTick()
    expect(root.dataset.theme).toBe('dark')
  })
})
