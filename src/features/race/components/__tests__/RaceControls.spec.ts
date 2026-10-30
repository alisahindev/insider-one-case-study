import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'
import RaceControls from '../RaceControls.vue'
import { mountWithRace } from './mountWithRace'

enableAutoUnmount(afterEach)

const press = (key: string, target: EventTarget = document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

describe('RaceControls', () => {
  it('generates a program and toggles start and pause', async () => {
    const { race, wrapper } = mountWithRace(RaceControls)
    const [generate, start] = wrapper.findAll('.btn')

    await generate!.trigger('click')
    expect(race.status).toBe('ready')
    expect(start!.text()).toContain('Start')

    await start!.trigger('click')
    expect(race.status).toBe('racing')
    expect(start!.text()).toContain('Pause')

    await start!.trigger('click')
    expect(start!.text()).toContain('Resume')
  })

  it('marks the selected playback speed', async () => {
    const { race, wrapper } = mountWithRace(RaceControls)
    await wrapper.findAll('.speed button')[2]!.trigger('click')
    expect(race.speed).toBe(4)
    expect(wrapper.findAll('[aria-pressed="true"]').map((b) => b.text())).toEqual(['4×'])
  })

  it('supports keyboard shortcuts', () => {
    const { race } = mountWithRace(RaceControls)
    press('g')
    expect(race.status).toBe('ready')
    press(' ')
    expect(race.status).toBe('racing')
    press('2')
    expect(race.speed).toBe(2)
  })

  it('leaves Space to a focused button so it does not toggle twice', () => {
    const { race, wrapper } = mountWithRace(RaceControls)
    race.generate()
    press(' ', wrapper.find('.btn').element)
    expect(race.status).toBe('ready')
  })

  it('shows the race day seed', () => {
    const { wrapper } = mountWithRace(RaceControls)
    expect(wrapper.find('.seed').text()).toContain('Race day #1')
  })
})
