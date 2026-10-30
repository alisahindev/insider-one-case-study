import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import HorseList from '../HorseList.vue'
import LiveStandings from '../LiveStandings.vue'
import ProgramPanel from '../ProgramPanel.vue'
import RaceHeader from '../RaceHeader.vue'
import RaceTrack from '../RaceTrack.vue'
import ResultsPanel from '../ResultsPanel.vue'
import { finishRound, mountWithRace } from './mountWithRace'

enableAutoUnmount(afterEach)

describe('HorseList', () => {
  it('lists all 20 horses with name, colour and condition', () => {
    const { race, wrapper } = mountWithRace(HorseList)
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(20)
    const first = race.horses[0]!
    expect(rows[0]!.text()).toContain(first.name)
    expect(rows[0]!.text()).toContain(first.color.name)
    expect(rows[0]!.find('meter').attributes('value')).toBe(String(first.condition))
  })

  it('dims horses that sit out the live round', async () => {
    const { race, wrapper } = mountWithRace(HorseList)
    race.start()
    await nextTick()
    expect(wrapper.findAll('tr.resting')).toHaveLength(10)
  })
})

describe('ProgramPanel', () => {
  it('invites the user to generate a program first', () => {
    const { wrapper } = mountWithRace(ProgramPanel)
    expect(wrapper.text()).toContain('Generate a program')
  })

  it('shows six rounds with distances, entrants and status', async () => {
    const { race, wrapper } = mountWithRace(ProgramPanel)
    race.start()
    await nextTick()
    const rounds = wrapper.findAll('.rounds > li')
    expect(rounds.map((r) => r.find('.round-title').text())).toEqual(
      [1200, 1400, 1600, 1800, 2000, 2200].map((d, i) => `Round ${i + 1} · ${d}m`),
    )
    expect(rounds[0]!.findAll('.entrants li')).toHaveLength(10)
    expect(rounds[0]!.find('.chip').text()).toBe('Live')
    expect(rounds[1]!.find('.chip').text()).toBe('Up next')
  })
})

describe('ResultsPanel', () => {
  it('adds each result as its round finishes, newest first, and announces the winner', async () => {
    const { race, wrapper } = mountWithRace(ResultsPanel)
    expect(wrapper.text()).toContain('Results land here')

    race.start()
    finishRound(race)
    finishRound(race)
    await nextTick()

    const titles = wrapper.findAll('.round-title').map((t) => t.text())
    expect(titles).toEqual(['Round 2 · 1400m', 'Round 1 · 1200m'])
    expect(wrapper.findAll('.round')[0]!.findAll('.finishers li')).toHaveLength(10)

    const winner = race.horsesById.get(race.results[1]!.placings[0]!.horseId)!
    expect(wrapper.find('[aria-live]').text()).toContain(`Round 2 finished. ${winner.name} wins`)
  })
})

describe('RaceTrack', () => {
  it('draws ten lanes in gate order once a program exists', async () => {
    const { race, wrapper } = mountWithRace(RaceTrack)
    expect(wrapper.text()).toContain('Set the field')

    race.generate()
    await nextTick()
    const names = wrapper.findAll('.lane .tag').map((t) => t.text())
    expect(names).toEqual(race.currentRound!.horseIds.map((id) => race.horsesById.get(id)!.name))
  })

  it('counts down, then shows the distance left', async () => {
    const { race, wrapper } = mountWithRace(RaceTrack)
    race.start()
    await nextTick()
    expect(wrapper.find('.countdown').text()).toBe('3')

    race.tick(3)
    race.tick(1)
    await nextTick()
    expect(wrapper.find('.to-go').text()).toMatch(/^\d+m to go$/)
  })
})

describe('RaceHeader', () => {
  it('names the round and tracks progress through the day', async () => {
    const { race, wrapper } = mountWithRace(RaceHeader)
    expect(wrapper.find('.title').text()).toBe('Race day')

    race.start()
    finishRound(race)
    await nextTick()
    expect(wrapper.find('.title').text()).toBe('Round 2 · 1400m')
    expect(wrapper.findAll('.progress li').map((li) => li.classes()[0])).toEqual([
      'done',
      'live',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ])
  })
})

describe('LiveStandings', () => {
  it('follows the store order', async () => {
    const { race, wrapper } = mountWithRace(LiveStandings)
    race.start()
    race.tick(3)
    race.tick(5)
    await nextTick()
    const names = wrapper.findAll('.name').map((n) => n.text())
    expect(names).toEqual(race.standings.map((s) => race.horsesById.get(s.horseId)!.name))
  })
})
