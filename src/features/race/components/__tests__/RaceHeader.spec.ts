import { enableAutoUnmount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { RACE_TIME_SCALE } from '../../stores/race'
import RaceHeader from '../RaceHeader.vue'
import { finishDay, finishRound, mountWithRace, tickUntil } from './mountWithRace'

enableAutoUnmount(afterEach)

const segments = (wrapper: VueWrapper) => wrapper.findAll('.progress li').map((li) => li.classes())

describe('RaceHeader', () => {
  it('names the day and shows every round upcoming before a program exists', () => {
    const { wrapper } = mountWithRace(RaceHeader)
    expect(wrapper.get('h2').text()).toBe('Race day')
    expect(wrapper.find('.subtitle').exists()).toBe(false)
    expect(segments(wrapper)).toEqual(Array.from({ length: 6 }, () => ['upcoming']))
    expect(wrapper.get('.progress').attributes('aria-label')).toBe('0 of 6 rounds finished')
  })

  it('names the round at the gate but keeps quiet until it runs', async () => {
    const { race, wrapper } = mountWithRace(RaceHeader)
    race.generate()
    await nextTick()
    expect(wrapper.get('h2').text()).toBe('Round 1 · 1200m')
    expect(wrapper.find('.subtitle').exists()).toBe(false)
    expect(segments(wrapper)[0]).toEqual(['upcoming'])
  })

  it('shows runners and a whole-second race clock while racing', async () => {
    const { race, wrapper } = mountWithRace(RaceHeader)
    race.start()
    await nextTick()
    expect(wrapper.get('.subtitle').text()).toBe('10 runners · 0:00')
    expect(segments(wrapper)[0]).toEqual(['live'])

    tickUntil(race, () => race.countdown === 0, 1)
    race.tick(9.95 / RACE_TIME_SCALE) // 9.95 s of race time: still "0:09"
    await nextTick()
    expect(wrapper.get('.subtitle').text()).toBe('10 runners · 0:09')

    race.tick(51.1 / RACE_TIME_SCALE) // 61.05 s: minutes roll over, seconds keep two digits
    await nextTick()
    expect(race.elapsed).toBeLessThan(race.roundDuration)
    expect(wrapper.get('.subtitle').text()).toBe('10 runners · 1:01')
  })

  it('keeps the live line while paused', async () => {
    const { race, wrapper } = mountWithRace(RaceHeader)
    race.start()
    race.pause()
    await nextTick()
    expect(wrapper.get('.subtitle').text()).toBe('10 runners · 0:00')
    expect(segments(wrapper)[0]).toEqual(['live'])
  })

  it('moves through the rounds, marking each one done', async () => {
    const { race, wrapper } = mountWithRace(RaceHeader)
    race.start()
    finishRound(race)
    finishRound(race)
    await nextTick()
    expect(wrapper.get('h2').text()).toBe('Round 3 · 1600m')
    expect(segments(wrapper).map(([state]) => state)).toEqual([
      'done',
      'done',
      'live',
      'upcoming',
      'upcoming',
      'upcoming',
    ])
    expect(wrapper.get('.progress').attributes('aria-label')).toBe('2 of 6 rounds finished')
  })

  it('ends on the last round with everything done and no live line', async () => {
    const { race, wrapper } = mountWithRace(RaceHeader)
    finishDay(race)
    await nextTick()
    expect(wrapper.get('h2').text()).toBe('Round 6 · 2200m')
    expect(wrapper.find('.subtitle').exists()).toBe(false)
    expect(segments(wrapper).every(([state]) => state === 'done')).toBe(true)
    expect(wrapper.get('.progress').attributes('aria-label')).toBe('6 of 6 rounds finished')
  })

  it('draws one segment per round, from one round to ten', async () => {
    const { race, wrapper } = mountWithRace(RaceHeader, {
      settings: { distances: [400], horsesPerRound: 1 },
    })
    expect(segments(wrapper)).toHaveLength(1)

    race.newRaceDay({ ...race.settings, distances: Array(10).fill(1000), horsesPerRound: 20 })
    race.start()
    await nextTick()
    expect(segments(wrapper)).toHaveLength(10)
    expect(wrapper.get('.subtitle').text()).toBe('20 runners · 0:00')
  })

  it('says "1 runner" for a one-horse field', async () => {
    const { race, wrapper } = mountWithRace(RaceHeader, { settings: { horsesPerRound: 1 } })
    race.start()
    await nextTick()
    expect(wrapper.get('.subtitle').text()).toBe('1 runner · 0:00')
  })
})
