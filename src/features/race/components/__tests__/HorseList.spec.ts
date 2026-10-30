import { enableAutoUnmount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import HorseList from '../HorseList.vue'
import { finishDay, finishRound, mountWithRace } from './mountWithRace'

enableAutoUnmount(afterEach)
beforeEach(() => localStorage.clear())

// The first row is the header (TransitionGroup is stubbed, so there is no real <tbody>).
const rows = (wrapper: VueWrapper) => wrapper.findAll('tr').slice(1)
const order = (wrapper: VueWrapper) =>
  rows(wrapper).map((row) => Number(/No\. (\d+)/.exec(row.get('.meta').text())![1]))
const resting = (wrapper: VueWrapper) =>
  rows(wrapper).map((row) => row.classes().includes('resting'))
const ascending = (ids: number[]) => ids.every((id, i) => i === 0 || id > ids[i - 1]!)

describe('HorseList', () => {
  it('is the Stable panel, labelled by its title, with a horse count', () => {
    const { wrapper } = mountWithRace(HorseList)
    const section = wrapper.get('section')
    expect(section.attributes('aria-labelledby')).toBe('stable-title')
    expect(wrapper.get('#stable-title').text()).toBe('Stable')
    expect(wrapper.get('.panel__meta').text()).toBe('20 horses')
    expect(wrapper.find('[aria-label="Move Stable panel"]').exists()).toBe(true)
  })

  it('lets keyboard users focus the scrolling list', () => {
    const { wrapper } = mountWithRace(HorseList)
    const body = wrapper.get('.panel__body')
    expect(body.attributes('tabindex')).toBe('0')
    expect(body.attributes('aria-labelledby')).toBe('stable-title')
  })

  it('lists every horse in stable order with silk, number, colour and condition', () => {
    const { race, wrapper } = mountWithRace(HorseList)
    expect(wrapper.findAll('th').map((th) => th.text())).toEqual(['Horse', 'Condition'])
    expect(order(wrapper)).toEqual(race.horses.map((h) => h.id))
    expect(resting(wrapper).some(Boolean)).toBe(false)

    const horse = race.horses[0]!
    const row = rows(wrapper)[0]!
    expect(row.get('.name').text()).toBe(horse.name)
    expect(row.get('.meta').text()).toBe(`No. ${horse.id} · ${horse.color.name}`)
    expect(row.find('svg.silk').exists()).toBe(true)
    expect(row.get('meter').attributes()).toMatchObject({
      value: String(horse.condition),
      min: '1',
      max: '100',
      'aria-label': `${horse.name} condition`,
    })
  })

  it('moves the runners of the round at the gate to the top and dims the rest', async () => {
    const { race, wrapper } = mountWithRace(HorseList)
    race.generate()
    await nextTick()
    const field = race.currentRound!.horseIds
    const ids = order(wrapper)
    expect(new Set(ids.slice(0, 10))).toEqual(new Set(field))
    // Each group keeps stable-number order.
    expect(ascending(ids.slice(0, 10))).toBe(true)
    expect(ascending(ids.slice(10))).toBe(true)
    expect(resting(wrapper)).toEqual([...Array(10).fill(false), ...Array(10).fill(true)])
  })

  it('keeps the live field on top while racing and paused', async () => {
    const { race, wrapper } = mountWithRace(HorseList)
    race.start()
    race.pause()
    await nextTick()
    expect(new Set(order(wrapper).slice(0, 10))).toEqual(new Set(race.currentRound!.horseIds))
    expect(wrapper.findAll('tr.resting')).toHaveLength(10)
  })

  it('switches to the next field when a round ends', async () => {
    const { race, wrapper } = mountWithRace(HorseList)
    race.start()
    finishRound(race)
    await nextTick()
    expect(new Set(order(wrapper).slice(0, 10))).toEqual(new Set(race.schedule[1]!.horseIds))
  })

  it('returns to stable order once the day is over', async () => {
    const { race, wrapper } = mountWithRace(HorseList)
    finishDay(race)
    await nextTick()
    expect(order(wrapper)).toEqual(race.horses.map((h) => h.id))
    expect(resting(wrapper).some(Boolean)).toBe(false)
  })

  it('dims nobody when every horse runs', async () => {
    const { race, wrapper } = mountWithRace(HorseList, {
      settings: { horseCount: 5, horsesPerRound: 5 },
    })
    race.generate()
    await nextTick()
    expect(rows(wrapper)).toHaveLength(5)
    expect(order(wrapper)).toEqual([1, 2, 3, 4, 5])
    expect(resting(wrapper).some(Boolean)).toBe(false)
  })

  it('lists a one-horse stable', () => {
    const { wrapper } = mountWithRace(HorseList, { settings: { horseCount: 1, horsesPerRound: 1 } })
    expect(rows(wrapper)).toHaveLength(1)
  })

  it('says "1 horse" for a one-horse stable', () => {
    const { wrapper } = mountWithRace(HorseList, { settings: { horseCount: 1, horsesPerRound: 1 } })
    expect(wrapper.get('.panel__meta').text()).toBe('1 horse')
  })
})
