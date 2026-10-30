import { enableAutoUnmount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { formatGap, formatRaceTime } from '../../utils/format'
import ResultsPanel from '../ResultsPanel.vue'
import { finishDay, finishRound, mountWithRace } from './mountWithRace'

enableAutoUnmount(afterEach)
beforeEach(() => localStorage.clear())

const rounds = (wrapper: VueWrapper) => wrapper.findAll('.round')
const lines = (list: Pick<DOMWrapper<Element>, 'findAll'>) =>
  list.findAll(':scope > li').map((li) => ({
    place: li.get('b').text(),
    name: li.get('span').text(),
    time: li.get('em').text(),
  }))

describe('ResultsPanel', () => {
  it('is the Results panel, labelled by its title', () => {
    const { wrapper } = mountWithRace(ResultsPanel)
    expect(wrapper.get('section').attributes('aria-labelledby')).toBe('results-title')
    expect(wrapper.get('#results-title').text()).toBe('Results')
  })

  it('waits for the first result with an empty message and a silent live region', () => {
    const { wrapper } = mountWithRace(ResultsPanel)
    expect(wrapper.get('.panel__empty').text()).toBe('Results land here as each round finishes.')
    expect(wrapper.get('.panel__meta').text()).toBe('0 of 6')
    const live = wrapper.get('[aria-live]')
    expect(live.attributes('aria-live')).toBe('polite')
    expect(live.text()).toBe('')
    expect(rounds(wrapper)).toHaveLength(0)
  })

  it('stays empty while the first round runs', async () => {
    const { race, wrapper } = mountWithRace(ResultsPanel)
    race.start()
    race.tick(5)
    await nextTick()
    expect(rounds(wrapper)).toHaveLength(0)
    expect(wrapper.find('.panel__empty').exists()).toBe(true)
  })

  it('shows the podium with the winning time and gaps, the rest one click away', async () => {
    const { race, wrapper } = mountWithRace(ResultsPanel)
    race.start()
    finishRound(race)
    await nextTick()

    const [round] = rounds(wrapper)
    expect(round!.get('.round-title').text()).toBe('Round 1 · 1200m')
    const placings = race.results[0]!.placings
    const expected = placings.map((p, i) => ({
      place: String(i + 1),
      name: race.horsesById.get(p.horseId)!.name,
      time: i === 0 ? formatRaceTime(p.time) : formatGap(p.time - placings[0]!.time),
    }))
    const [podium, rest] = round!.findAll('.finishers')
    expect(lines(podium!)).toEqual(expected.slice(0, 3))
    expect(round!.get('summary').text()).toBe('All 10 finishers')
    expect(lines(rest!)).toEqual(expected.slice(3))
    expect(expected[0]!.time).toMatch(/^\d+:\d{2}\.\d{2}$/)
    expect(expected[1]!.time).toMatch(/^\+\d+\.\d{2}$/)
    expect(round!.get('details').attributes('open')).toBeUndefined()
  })

  it('adds each round on top as it finishes and announces the winner', async () => {
    const { race, wrapper } = mountWithRace(ResultsPanel)
    race.start()
    finishRound(race)
    finishRound(race)
    await nextTick()

    expect(rounds(wrapper).map((r) => r.get('.round-title').text())).toEqual([
      'Round 2 · 1400m',
      'Round 1 · 1200m',
    ])
    expect(wrapper.get('.panel__meta').text()).toBe('2 of 6')
    expect(wrapper.find('.panel__empty').exists()).toBe(false)

    const winner = race.results[1]!.placings[0]!
    expect(wrapper.get('[aria-live]').text()).toBe(
      `Round 2 finished. ${race.horsesById.get(winner.horseId)!.name} wins in ${formatRaceTime(winner.time)}.`,
    )
  })

  it('holds all six results once the day is over', async () => {
    const { race, wrapper } = mountWithRace(ResultsPanel)
    finishDay(race)
    await nextTick()
    expect(wrapper.get('.panel__meta').text()).toBe('6 of 6')
    expect(rounds(wrapper).map((r) => r.get('.round-title').text())).toEqual(
      [2200, 2000, 1800, 1600, 1400, 1200].map((d, i) => `Round ${6 - i} · ${d}m`),
    )
  })

  it('shows no "All finishers" toggle for exactly three runners', async () => {
    const { race, wrapper } = mountWithRace(ResultsPanel, { settings: { horsesPerRound: 3 } })
    race.start()
    finishRound(race)
    await nextTick()
    expect(rounds(wrapper)[0]!.findAll('.finishers > li')).toHaveLength(3)
    expect(wrapper.find('details').exists()).toBe(false)
  })

  it('shows the toggle from four runners on', async () => {
    const { race, wrapper } = mountWithRace(ResultsPanel, { settings: { horsesPerRound: 4 } })
    race.start()
    finishRound(race)
    await nextTick()
    expect(wrapper.get('summary').text()).toBe('All 4 finishers')
    expect(lines(wrapper.findAll('.finishers')[1]!).map((l) => l.place)).toEqual(['4'])
  })

  it('handles a walkover: one runner, one round', async () => {
    const { race, wrapper } = mountWithRace(ResultsPanel, {
      settings: { horseCount: 1, horsesPerRound: 1, distances: [400] },
    })
    race.start()
    finishRound(race)
    await nextTick()
    expect(wrapper.get('.panel__meta').text()).toBe('1 of 1')
    expect(lines(wrapper.get('.finishers'))).toEqual([
      {
        place: '1',
        name: race.horses[0]!.name,
        time: formatRaceTime(race.results[0]!.placings[0]!.time),
      },
    ])
    expect(wrapper.find('details').exists()).toBe(false)
  })

  it('clears for a new program or a new race day', async () => {
    const { race, wrapper } = mountWithRace(ResultsPanel)
    race.start()
    finishRound(race)
    race.generate()
    await nextTick()
    expect(rounds(wrapper)).toHaveLength(0)
    expect(wrapper.get('[aria-live]').text()).toBe('')

    race.start()
    finishRound(race)
    race.newRaceDay({ ...race.settings, distances: [1000, 1200] })
    await nextTick()
    expect(rounds(wrapper)).toHaveLength(0)
    expect(wrapper.get('.panel__meta').text()).toBe('0 of 2')
  })
})
