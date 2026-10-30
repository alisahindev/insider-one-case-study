import { enableAutoUnmount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import LiveStandings from '../LiveStandings.vue'
import { finishDay, mountWithRace, tickUntil } from './mountWithRace'

enableAutoUnmount(afterEach)

type Race = ReturnType<typeof mountWithRace>['race']
const names = (wrapper: VueWrapper) => wrapper.findAll('.name').map((n) => n.text())
const expectedNames = (race: Race) =>
  race.standings.map((s) => race.horsesById.get(s.horseId)!.name)
const orderOf = (race: Race) => race.standings.map((s) => s.horseId).join()

describe('LiveStandings', () => {
  it('is a labelled region with a hint before any round is drawn', () => {
    const { wrapper } = mountWithRace(LiveStandings)
    expect(wrapper.get('section').attributes('aria-label')).toBe('Live standings')
    expect(wrapper.get('.empty').text()).toBe('Live standings appear here once a round is drawn.')
    expect(wrapper.findAll('li')).toHaveLength(0)
  })

  it('lists the field at the gate once a program exists', async () => {
    const { race, wrapper } = mountWithRace(LiveStandings)
    race.generate()
    await nextTick()
    expect(wrapper.find('.empty').exists()).toBe(false)
    expect(names(wrapper)).toEqual(expectedNames(race))
    expect(wrapper.findAll('li b').map((b) => b.text())).toEqual(
      Array.from({ length: 10 }, (_, i) => String(i + 1)),
    )
    expect(wrapper.findAll('li svg.silk')).toHaveLength(10)
  })

  it('follows the running order and highlights the leader', async () => {
    const { race, wrapper } = mountWithRace(LiveStandings)
    race.start()
    tickUntil(race, () => race.elapsed > 20)
    await nextTick()
    expect(names(wrapper)).toEqual(expectedNames(race))
    const items = wrapper.findAll('li')
    expect(items[0]!.classes()).toContain('leader')
    expect(items.slice(1).some((li) => li.classes().includes('leader'))).toBe(false)
  })

  it('ends on the finishing order of the last round', async () => {
    const { race, wrapper } = mountWithRace(LiveStandings)
    finishDay(race)
    await nextTick()
    const last = race.results[race.results.length - 1]!.placings
    expect(names(wrapper)).toEqual(last.map((p) => race.horsesById.get(p.horseId)!.name))
  })

  it('re-renders on overtakes only, not on every frame', async () => {
    const { race, wrapper } = mountWithRace(LiveStandings)
    race.start()
    tickUntil(race, () => race.countdown === 0, 1)
    await nextTick()
    const instance = wrapper.vm.$ as unknown as { render: (...args: unknown[]) => unknown }
    const render = vi.fn<(...args: unknown[]) => unknown>(instance.render)
    instance.render = render

    let frames = 0
    let overtakes = 0
    while (frames < 300 && race.results.length === 0) {
      const before = orderOf(race)
      race.tick(1 / 60)
      await nextTick()
      frames++
      if (orderOf(race) !== before) overtakes++
    }
    expect(overtakes).toBeGreaterThan(0)
    expect(overtakes).toBeLessThan(frames)
    expect(render).toHaveBeenCalledTimes(overtakes)
    expect(names(wrapper)).toEqual(expectedNames(race))
  })

  it('shows a lone runner and empties again for a new race day', async () => {
    const { race, wrapper } = mountWithRace(LiveStandings, { settings: { horsesPerRound: 1 } })
    race.generate()
    await nextTick()
    expect(wrapper.findAll('li')).toHaveLength(1)
    expect(wrapper.get('li').classes()).toContain('leader')

    race.newRaceDay(race.settings)
    await nextTick()
    expect(wrapper.find('.empty').exists()).toBe(true)
  })
})
