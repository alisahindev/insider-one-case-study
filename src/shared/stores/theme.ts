import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { readStorage, writeStorage } from '../storage'

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

// Same key index.html reads before first paint, so a saved theme never flashes.
const STORAGE_KEY = '1nsider:theme'

function load(): Theme {
  const saved = readStorage(STORAGE_KEY)
  return THEMES.includes(saved as Theme) ? (saved as Theme) : 'system'
}

/** Appearance preference. Applies instantly via data-theme on <html>; "system" follows the device. */
export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(load())

  watch(
    theme,
    (value) => {
      const root = document.documentElement
      if (value === 'system') delete root.dataset.theme
      else root.dataset.theme = value
      writeStorage(STORAGE_KEY, value)
    },
    { immediate: true },
  )

  return { theme }
})
