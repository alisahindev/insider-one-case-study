import { enableAutoUnmount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import ProgramPanel from '../ProgramPanel.vue'
import { finishDay, finishRound, mountWithRace } from './mountWithRace'

enableAutoUnmount(afterEach)
beforeEach(() => localStorage.clear())

const rounds = (wrapper: VueWrapper) => wrapper.findAll('.rounds > li')
const chips = (wrapper: VueWrapper) => wrapper.findAll('.chip').map((c) => c.text())

describe('ProgramPanel', () => {
  it('is the Program panel, labelled by its title, with a round count', () => {
    const { wrapper } = mountWithRace(ProgramPanel)
    expect(wrapper.get('section').attributes('aria-labelledby')).toBe('program-title')
    expect(wrapper.get('#program-title').text()).toBe('Program')
    expect(wrapper.get('.panel__meta').text()).toBe('6 rounds')
  })

  it('asks for a program before one exists', () => {
    const { wrapper } = mountWithRace(ProgramPanel)
    expect(wrapper.get('.panel__empty').text()).toBe(
      'Generate a program to draw 10 horses for each round.',
    )
    expect(wrapper.find('.rounds').exists()).toBe(false)
  })

  it('lists every round with its distance and entrants in gate order', async () => {
    const { race, wrapper } = mountWithRace(ProgramPanel)
    race.generate()
    await nextTick()
    expect(wrapper.find('.panel__empty').exists()).toBe(false)
    expect(rounds(wrapper).map((r) => r.get('.round-title').text())).toEqual(
      [1200, 1400, 1600, 1800, 2000, 2200].map((d, i) => `Round ${i + 1} · ${d}m`),
    )
    expect(chips(wrapper)).toEqual(Array(6).fill('Up next'))

    race.schedule.forEach((round, i) => {
      const entrants = rounds(wrapper)[i]!.findAll('.entrants li')
      expect(entrants.map((e) => e.text())).toEqual(
        round.horseIds.map((id, gate) => `${gate + 1} ${race.horsesById.get(id)!.name}`),
      )
      expect(rounds(wrapper)[i]!.findAll('.silks svg')).toHaveLength(10)
    })
  })

  it('keeps each round collapsed until opened, with the silks hidden from screen readers', async () => {
    const { race, wrapper } = mountWithRace(ProgramPanel)
    race.generate()
    await nextTick()
    const details = wrapper.get('details')
    expect(details.attributes('open')).toBeUndefined()
    expect(details.get('.silks').attributes('aria-hidden')).toBe('true')
  })

  it('marks the live round, then finished rounds, as the day runs', async () => {
    const { race, wrapper } = mountWithRace(ProgramPanel)
    race.start()
    await nextTick()
    expect(chips(wrapper)).toEqual(['Live', ...Array(5).fill('Up next')])
    expect(wrapper.findAll('.chip')[0]!.classes()).toContain('live')

    finishRound(race)
    race.pause()
    await nextTick()
    expect(chips(wrapper)).toEqual(['Finished', 'Live', ...Array(4).fill('Up next')])
    expect(wrapper.findAll('.chip')[0]!.classes()).toContain('done')

    finishDay(race)
    await nextTick()
    expect(chips(wrapper)).toEqual(Array(6).fill('Finished'))
  })

  it('clears the program for a new race day', async () => {
    const { race, wrapper } = mountWithRace(ProgramPanel)
    race.generate()
    race.newRaceDay({ ...race.settings, horsesPerRound: 4 })
    await nextTick()
    expect(wrapper.get('.panel__empty').text()).toContain('draw 4 horses')
  })

  it('handles ten rounds of a single runner', async () => {
    const { race, wrapper } = mountWithRace(ProgramPanel, {
      settings: { horsesPerRound: 1, distances: Array(10).fill(800) },
    })
    race.generate()
    await nextTick()
    expect(wrapper.get('.panel__meta').text()).toBe('10 rounds')
    expect(rounds(wrapper)).toHaveLength(10)
    expect(rounds(wrapper).every((r) => r.findAll('.entrants li').length === 1)).toBe(true)
  })

  it('says "1 round" for a single-round day', () => {
    const { wrapper } = mountWithRace(ProgramPanel, { settings: { distances: [800] } })
    expect(wrapper.get('.panel__meta').text()).toBe('1 round')
  })
})
