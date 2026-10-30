import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

// Same key index.html reads before first paint, so a saved theme never flashes.
const STORAGE_KEY = '1nsider:theme'

function load(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return THEMES.includes(saved as Theme) ? (saved as Theme) : 'system'
  } catch {
    return 'system'
  }
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
      try {
        localStorage.setItem(STORAGE_KEY, value)
      } catch {
        // The choice still applies for this visit.
      }
    },
    { immediate: true },
  )

  return { theme }
})
