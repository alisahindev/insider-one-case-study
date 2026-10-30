import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import SetupSummary from '../SetupSummary.vue'
import { mountWithRace } from './mountWithRace'

enableAutoUnmount(afterEach)
beforeEach(() => localStorage.clear())

describe('SetupSummary', () => {
  it('shows the running race day at a glance', () => {
    const { wrapper } = mountWithRace(SetupSummary)
    expect(wrapper.findAll('.part').map((p) => p.text())).toEqual([
      '20 horses',
      '6 rounds',
      '10 per round',
    ])
  })

  it('gives the pill a name that says what clicking does', () => {
    const { wrapper } = mountWithRace(SetupSummary)
    const pill = wrapper.get('button')
    expect(pill.get('.sr-only').text()).toBe(', change race day settings')
    expect(pill.get('.action').attributes('aria-hidden')).toBe('true')
  })

  it('opens the setup dialog', async () => {
    const { wrapper } = mountWithRace(SetupSummary)
    await wrapper.get('button').trigger('click')
    expect(useSettingsStore().isSetupOpen).toBe(true)
  })

  it('follows a new race day, not unsaved form edits', async () => {
    const { race, wrapper } = mountWithRace(SetupSummary)
    useSettingsStore().settings.horseCount = 3 // what the form remembers, not the running day
    await nextTick()
    expect(wrapper.text()).toContain('20 horses')

    race.newRaceDay({ ...race.settings, horseCount: 5, horsesPerRound: 2, distances: [800, 1000] })
    await nextTick()
    expect(wrapper.findAll('.part').map((p) => p.text())).toEqual([
      '5 horses',
      '2 rounds',
      '2 per round',
    ])
  })

  it('uses singular nouns for a one-horse, one-round day', () => {
    const { wrapper } = mountWithRace(SetupSummary, {
      settings: { horseCount: 1, horsesPerRound: 1, distances: [800] },
    })
    expect(wrapper.findAll('.part').map((p) => p.text())).toEqual([
      '1 horse',
      '1 round',
      '1 per round',
    ])
  })
})
