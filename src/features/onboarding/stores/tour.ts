import { defineStore } from 'pinia'
import { ref } from 'vue'
import { readStorage, writeStorage } from '@/shared/storage'
import { TOUR_STEPS } from '../steps'

const STORAGE_KEY = '1nsider:tour-seen'

/** The onboarding tour. `step` is null while the tour is closed. */
export const useTourStore = defineStore('tour', () => {
  const step = ref<number | null>(null)

  function start() {
    step.value = 0
  }

  /** First visit only; skipping or finishing counts as seen. */
  function startIfNew() {
    if (readStorage(STORAGE_KEY) !== '1') start()
  }

  function next() {
    if (step.value === null) return
    if (step.value < TOUR_STEPS.length - 1) step.value++
    else close()
  }

  function back() {
    if (step.value) step.value--
  }

  function close() {
    step.value = null
    writeStorage(STORAGE_KEY, '1')
  }

  return { step, start, startIfNew, next, back, close }
})
