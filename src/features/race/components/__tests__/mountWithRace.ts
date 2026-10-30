import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { DEFAULT_SETTINGS, type RaceSettings } from '../../domain/settings'
import { useRaceStore } from '../../stores/race'

type RaceStore = ReturnType<typeof useRaceStore>

interface Options {
  /** Overrides for the race day; the seed defaults to 1 so every run sees the same horses. */
  settings?: Partial<RaceSettings>
  props?: Record<string, unknown>
}

/** Mounts a component against a real Pinia and a seeded race day; no mocks to drift from production. */
export function mountWithRace(component: Component, { settings, props }: Options = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const race = useRaceStore()
  race.newRaceDay({ ...DEFAULT_SETTINGS, seed: 1, ...settings })
  const wrapper = mount(component, { props, global: { plugins: [pinia] }, attachTo: document.body })
  return { race, wrapper, pinia }
}

/** Ticks the race until `done` holds; throws instead of looping forever if it never does. */
export function tickUntil(race: RaceStore, done: () => boolean, seconds = 0.05) {
  for (let i = 0; i < 100_000 && !done(); i++) race.tick(seconds)
  if (!done()) throw new Error('tickUntil: condition never met')
}

/** Runs the current round (countdown included) past the finish line. */
export function finishRound(race: RaceStore) {
  const finished = race.results.length
  tickUntil(race, () => race.results.length > finished, 1)
}

/** Starts the day if needed and runs every round. */
export function finishDay(race: RaceStore) {
  if (race.status !== 'racing') race.start()
  tickUntil(race, () => race.status === 'finished', 1)
}
