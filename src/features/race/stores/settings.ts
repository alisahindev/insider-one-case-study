import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DEFAULT_SETTINGS, normalizeSettings, type RaceSettings } from '../domain/settings'

const STORAGE_KEY = '1nsider:settings'

// Storage can be blocked (private mode) or hold stale data; both fall back to defaults.
function load(): RaceSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? normalizeSettings({ ...JSON.parse(saved), seed: null }) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** The setup form's last choices, remembered between visits. Seeds are never remembered. */
export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<RaceSettings>(load())
  const isSetupOpen = ref(false)

  function save(next: RaceSettings) {
    settings.value = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, seed: null }))
    } catch {
      // Not persisting is fine; the race day still uses `next`.
    }
  }

  return { settings, isSetupOpen, save }
})
