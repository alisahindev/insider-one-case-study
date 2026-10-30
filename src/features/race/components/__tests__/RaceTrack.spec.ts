import { enableAutoUnmount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import RaceTrack from '../RaceTrack.vue'
import { finishDay, finishRound, mountWithRace, tickUntil } from './mountWithRace'

enableAutoUnmount(afterEach)
beforeEach(() => localStorage.clear())

const cssVar = (el: { element: Element }, name: string) =>
  (el.element as HTMLElement).style.getPropertyValue(name)
const lanes = (wrapper: VueWrapper) => wrapper.findAll('.lane')
const tags = (wrapper: VueWrapper) => wrapper.findAll('.tag').map((t) => t.text())
const poses = (wrapper: VueWrapper) =>
  wrapper.findAll('.figure').map((f) => f.classes().find((c) => c.startsWith('figure--')))
const progress = (wrapper: VueWrapper) =>
  wrapper.findAll('.runner').map((r) => cssVar(r, '--progress'))
const notice = (wrapper: VueWrapper) => wrapper.find('.notice')
const buttonByText = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text)!

describe('RaceTrack', () => {
  describe('before a program', () => {
    it('invites the user to set the field', () => {
      const { wrapper } = mountWithRace(RaceTrack)
      expect(notice(wrapper).get('h3').text()).toBe('Set the field')
      expect(notice(wrapper).get('p').text()).toBe(
        'Draw 10 of your 20 horses for each of the 6 rounds.',
      )
      expect(lanes(wrapper)).toHaveLength(0)
      expect(wrapper.findAll('.pole')).toHaveLength(0)
      expect(wrapper.find('.chip').exists()).toBe(false)
      expect(wrapper.find('.countdown').exists()).toBe(false)
    })

    it('generates a program from the notice', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack)
      await buttonByText(wrapper, 'Generate program').trigger('click')
      expect(race.status).toBe('ready')
      expect(notice(wrapper).get('h3').text()).toBe('Round 1 is at the gate')
    })

    it('opens race settings from the notice', async () => {
      const { wrapper } = mountWithRace(RaceTrack)
      await buttonByText(wrapper, 'Race settings').trigger('click')
      expect(useSettingsStore().isSetupOpen).toBe(true)
    })

    it('says "the one round" for a single-round day', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack, { settings: { distances: [1600] } })
      expect(notice(wrapper).text()).toContain('for the one round.')
      race.generate()
      await nextTick()
      expect(notice(wrapper).get('p').text()).toBe('One round of 1600m.')
    })

    it('phrases the notices for one horse and one round', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack, {
        settings: { horseCount: 1, horsesPerRound: 1, distances: [400] },
      })
      expect(notice(wrapper).text()).not.toContain('1 horses')
      race.generate()
      await nextTick()
      expect(notice(wrapper).text()).not.toContain('from 400m to 400m')
    })
  })

  describe('with a program at the gate', () => {
    it('summarises the day and lines the runners up in gate order', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack)
      race.generate()
      await nextTick()
      expect(notice(wrapper).get('p').text()).toBe(
        '6 rounds from 1200m to 2200m, run back to back.',
      )
      const names = race.currentRound!.horseIds.map((id) => race.horsesById.get(id)!.name)
      expect(tags(wrapper)).toEqual(names)
      expect(wrapper.findAll('.gate').map((g) => g.text())).toEqual(
        names.map((_, i) => String(i + 1)),
      )
      expect(progress(wrapper).every((p) => p === '0')).toBe(true)
      expect(poses(wrapper).every((p) => p === 'figure--stand')).toBe(true)
      expect(wrapper.find('.chip').exists()).toBe(false)
    })

    it('paints each lane in its horse colour', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack)
      race.generate()
      await nextTick()
      const first = race.horsesById.get(race.currentRound!.horseIds[0]!)!
      expect(cssVar(wrapper.get('.run'), '--coat')).toBe(first.color.hex)
    })

    it('starts the races or opens settings from the notice', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack)
      race.generate()
      await nextTick()
      await buttonByText(wrapper, 'Race settings').trigger('click')
      expect(useSettingsStore().isSetupOpen).toBe(true)

      await buttonByText(wrapper, 'Start the races').trigger('click')
      expect(race.status).toBe('racing')
      expect(notice(wrapper).exists()).toBe(false)
    })

    it('puts a pole every 400m to go, none on a 400m sprint', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack)
      race.generate()
      await nextTick()
      const poles = wrapper.findAll('.pole')
      expect(poles.map((p) => p.text())).toEqual(['400m', '800m'])
      expect(poles.map((p) => Number(cssVar(p, '--at')))).toEqual([1 - 400 / 1200, 1 - 800 / 1200])
      expect(wrapper.get('.course').attributes('aria-hidden')).toBe('true')

      race.newRaceDay({ ...race.settings, distances: [2200, 400] })
      race.generate()
      await nextTick()
      expect(wrapper.findAll('.pole').map((p) => p.text())).toEqual([
        '400m',
        '800m',
        '1200m',
        '1600m',
        '2000m',
      ])
      race.start()
      finishRound(race)
      await nextTick()
      expect(race.currentRound!.distance).toBe(400)
      expect(wrapper.findAll('.pole')).toHaveLength(0)
    })

    it('draws one lane per runner, from a single horse to twenty', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack, { settings: { horsesPerRound: 1 } })
      race.generate()
      await nextTick()
      expect(lanes(wrapper)).toHaveLength(1)
      expect(cssVar(wrapper, '--lanes')).toBe('1')

      race.newRaceDay({ ...race.settings, horsesPerRound: 20 })
      race.generate()
      await nextTick()
      expect(lanes(wrapper)).toHaveLength(20)
      expect(cssVar(wrapper, '--lanes')).toBe('20')
    })

    it('passes the playback speed to the animations', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack)
      expect(cssVar(wrapper, '--speed')).toBe('1')
      race.setSpeed(4)
      await nextTick()
      expect(cssVar(wrapper, '--speed')).toBe('4')
    })
  })

  describe('during a round', () => {
    it('counts down in whole seconds with the horses standing', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack)
      race.start()
      await nextTick()
      expect(wrapper.get('.countdown').text()).toBe('3')
      expect(poses(wrapper).every((p) => p === 'figure--stand')).toBe(true)
      expect(wrapper.find('.to-go').exists()).toBe(false)
      expect(notice(wrapper).exists()).toBe(false)

      race.tick(0.5)
      await nextTick()
      expect(wrapper.get('.countdown').text()).toBe('3')
      race.tick(0.6)
      await nextTick()
      expect(wrapper.get('.countdown').text()).toBe('2')
    })

    it('gallops the field and shows the distance left in 50m steps', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack)
      race.start()
      tickUntil(race, () => race.countdown === 0, 1)
      race.tick(1)
      await nextTick()

      expect(wrapper.find('.countdown').exists()).toBe(false)
      expect(poses(wrapper).every((p) => p === 'figure--gallop')).toBe(true)
      const leader = race.standings[0]!
      const left = Math.ceil((1200 - leader.distance) / 50) * 50
      expect(wrapper.get('.to-go').text()).toBe(`${left}m to go`)
      expect(left % 50).toBe(0)

      const byId = new Map(race.standings.map((s) => [s.horseId, s.distance / 1200]))
      const expected = race.currentRound!.horseIds.map((id) => String(byId.get(id)))
      expect(progress(wrapper)).toEqual(expected)
      expect(wrapper.findAll('.trail').map((t) => cssVar(t, '--progress'))).toEqual(expected)
    })

    it('holds the horses mid-stride and shows a Paused chip', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack)
      race.start()
      tickUntil(race, () => race.elapsed > 5)
      race.pause()
      await nextTick()
      expect(wrapper.get('.paused').text()).toBe('Paused')
      expect(poses(wrapper).every((p) => p === 'figure--hold')).toBe(true)
      expect(wrapper.find('.to-go').exists()).toBe(true)
    })

    it('freezes the countdown when paused before the off', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack)
      race.start()
      race.pause()
      await nextTick()
      expect(wrapper.find('.countdown').exists()).toBe(false)
      expect(wrapper.find('.to-go').exists()).toBe(false)
      expect(wrapper.get('.paused').text()).toBe('Paused')
      expect(poses(wrapper).every((p) => p === 'figure--stand')).toBe(true)
    })

    it('places finishers as they cross the line and pulls them up', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack)
      race.start()
      tickUntil(race, () => race.standings[0]!.finished)
      await nextTick()
      expect(race.results).toHaveLength(0)
      expect(race.standings.some((s) => !s.finished)).toBe(true)

      expect(wrapper.get('.to-go').text()).toBe('Finish')
      const winner = race.horsesById.get(race.standings[0]!.horseId)!
      const winnerTag = wrapper.get('.tag.winner')
      expect(winnerTag.text()).toBe(`1. ${winner.name}`)
      expect(wrapper.findAll('.tag.winner')).toHaveLength(1)

      const lane = lanes(wrapper).find((l) => l.text().includes(winner.name))!
      expect(lane.get('.figure').classes()).toContain('figure--stand')
      expect(poses(wrapper)).toContain('figure--gallop')
      expect(progress(wrapper)[race.currentRound!.horseIds.indexOf(winner.id)]).toBe('1')
    })

    it('resets the lanes and the countdown for the next round', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack)
      race.start()
      finishRound(race)
      await nextTick()
      const names = race.schedule[1]!.horseIds.map((id) => race.horsesById.get(id)!.name)
      expect(tags(wrapper)).toEqual(names)
      expect(progress(wrapper).every((p) => p === '0')).toBe(true)
      expect(wrapper.get('.countdown').text()).toBe('3')
    })

    it('starts at once when the countdown is turned off', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack, { settings: { countdown: false } })
      race.start()
      await nextTick()
      expect(wrapper.find('.countdown').exists()).toBe(false)
      expect(wrapper.get('.to-go').text()).toBe('1200m to go')
      expect(poses(wrapper).every((p) => p === 'figure--gallop')).toBe(true)
    })
  })

  describe('after the last round', () => {
    it('shows every place and offers another program', async () => {
      const { race, wrapper } = mountWithRace(RaceTrack)
      finishDay(race)
      await nextTick()
      expect(notice(wrapper).get('h3').text()).toBe('Race day complete')
      const place = new Map(race.standings.map((s, i) => [s.horseId, i + 1]))
      expect(tags(wrapper)).toEqual(
        race.currentRound!.horseIds.map(
          (id) => `${place.get(id)}. ${race.horsesById.get(id)!.name}`,
        ),
      )
      expect(poses(wrapper).every((p) => p === 'figure--stand')).toBe(true)
      expect(wrapper.find('.chip').exists()).toBe(false)

      const program = race.programSeed
      await buttonByText(wrapper, 'Race again').trigger('click')
      expect(race.status).toBe('racing')
      expect(race.results).toEqual([])
      expect(race.programSeed).not.toBe(program)
    })
  })
})
