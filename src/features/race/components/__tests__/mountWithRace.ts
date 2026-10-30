import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { COUNTDOWN_SECONDS } from '../../domain/config'
import { useRaceStore } from '../../stores/race'

/** Mounts a component against a real, seeded race store; no mocks to drift from production. */
export function mountWithRace(component: Component) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const race = useRaceStore()
  race.setSeed(1)
  const wrapper = mount(component, { global: { plugins: [pinia] }, attachTo: document.body })
  return { race, wrapper }
}

export function finishRound(race: ReturnType<typeof useRaceStore>) {
  race.tick(COUNTDOWN_SECONDS)
  race.tick(1_000)
}
