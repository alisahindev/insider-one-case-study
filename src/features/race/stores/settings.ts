import { defineStore } from 'pinia'
import { ref } from 'vue'
import { readStorage, writeStorage } from '@/shared/storage'
import { DEFAULT_SETTINGS, normalizeSettings, type RaceSettings } from '../domain/settings'

const STORAGE_KEY = '1nsider:settings'

// Saved data can be stale or hand-edited; anything unreadable falls back to defaults.
function load(): RaceSettings {
  const saved = readStorage(STORAGE_KEY)
  if (!saved) return DEFAULT_SETTINGS
  try {
    return normalizeSettings({ ...JSON.parse(saved), seed: null })
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
    writeStorage(STORAGE_KEY, JSON.stringify({ ...next, seed: null }))
  }

  return { settings, isSetupOpen, save }
})
