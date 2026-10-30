import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import RaceControls from '../RaceControls.vue'
import { finishDay, mountWithRace } from './mountWithRace'

enableAutoUnmount(afterEach)
afterEach(() => document.body.replaceChildren())

/** Dispatches a keydown like a real keypress (bubbles to window, cancelable) and returns it. */
function press(key: string, target: EventTarget = document.body, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

const setup = () => {
  const mounted = mountWithRace(RaceControls)
  const [generate, start] = mounted.wrapper.findAll('.btn')
  return { ...mounted, generate: generate!, start: start! }
}

describe('RaceControls', () => {
  describe('speed pills', () => {
    it('groups the speeds under an accessible name and presses the current one', () => {
      const { wrapper } = setup()
      expect(wrapper.find('[role="group"]').attributes('aria-label')).toBe('Playback speed')
      const pills = wrapper.findAll('.speed button')
      expect(pills.map((b) => b.text())).toEqual(['1×', '2×', '4×'])
      expect(pills.map((b) => b.attributes('aria-pressed'))).toEqual(['true', 'false', 'false'])
    })

    it('changes the playback speed on click', async () => {
      const { race, wrapper } = setup()
      await wrapper.findAll('.speed button')[2]!.trigger('click')
      expect(race.speed).toBe(4)
      expect(wrapper.findAll('[aria-pressed="true"]').map((b) => b.text())).toEqual(['4×'])
    })

    it('starts at the speed the race day was set up with', () => {
      const { wrapper } = mountWithRace(RaceControls, { settings: { speed: 2 } })
      expect(wrapper.find('[aria-pressed="true"]').text()).toBe('2×')
    })
  })

  describe('buttons', () => {
    it('advertises its keyboard shortcuts', () => {
      const { generate, start } = setup()
      expect(generate.attributes('aria-keyshortcuts')).toBe('G')
      expect(start.attributes('aria-keyshortcuts')).toBe('Space')
    })

    it('draws a new program every time Generate is clicked', async () => {
      const { race, generate } = setup()
      await generate.trigger('click')
      expect(race.status).toBe('ready')
      const first = race.programSeed
      await generate.trigger('click')
      expect(race.programSeed).not.toBe(first)
      expect(race.schedule).toHaveLength(6)
    })

    it('labels the main button for every race status and follows it', async () => {
      const { race, start } = setup()
      expect(start.text()).toBe('Start')

      race.generate()
      await nextTick()
      expect(start.text()).toBe('Start')

      await start.trigger('click')
      expect(race.status).toBe('racing')
      expect(start.text()).toBe('Pause')

      await start.trigger('click')
      expect(race.status).toBe('paused')
      expect(start.text()).toBe('Resume')

      await start.trigger('click')
      expect(race.status).toBe('racing')

      finishDay(race)
      await nextTick()
      expect(start.text()).toBe('Race again')

      await start.trigger('click')
      expect(race.status).toBe('racing')
      expect(race.results).toEqual([])
    })

    it('starts straight from idle by drawing a program first', async () => {
      const { race, start } = setup()
      await start.trigger('click')
      expect(race.status).toBe('racing')
      expect(race.schedule).toHaveLength(6)
    })

    it('swaps the play icon for a pause icon only while racing', async () => {
      const { race, start } = setup()
      expect(start.findAll('rect')).toHaveLength(0)
      race.start()
      await nextTick()
      expect(start.findAll('rect')).toHaveLength(2)
      race.pause()
      await nextTick()
      expect(start.findAll('rect')).toHaveLength(0)
    })
  })

  describe('keyboard shortcuts', () => {
    it('G draws, Space toggles, 1/2/4 set the speed', () => {
      const { race } = setup()
      expect(press('g').defaultPrevented).toBe(true)
      expect(race.status).toBe('ready')
      press(' ')
      expect(race.status).toBe('racing')
      press(' ')
      expect(race.status).toBe('paused')
      press('2')
      expect(race.speed).toBe(2)
      press('4')
      expect(race.speed).toBe(4)
      press('1')
      expect(race.speed).toBe(1)
    })

    it('accepts an upper-case G (Caps Lock or Shift)', () => {
      const { race } = setup()
      press('G', document.body, { shiftKey: true })
      expect(race.status).toBe('ready')
    })

    it('leaves other keys alone and does not swallow them', () => {
      const { race } = setup()
      expect(press('3').defaultPrevented).toBe(false)
      expect(press('Enter').defaultPrevented).toBe(false)
      expect(race.speed).toBe(1)
      expect(race.status).toBe('idle')
    })

    it.each([
      ['Ctrl', { ctrlKey: true }],
      ['Cmd', { metaKey: true }],
      ['Alt', { altKey: true }],
      ['auto-repeat', { repeat: true }],
    ])('ignores %s + G so browser shortcuts keep working', (_, init) => {
      const { race } = setup()
      expect(press('g', document.body, init).defaultPrevented).toBe(false)
      expect(race.status).toBe('idle')
    })

    it.each(['input', 'textarea', 'select'])('ignores keys typed in a %s', (tag) => {
      const { race } = setup()
      const field = document.body.appendChild(document.createElement(tag))
      press('g', field)
      press(' ', field)
      press('4', field)
      expect(race.status).toBe('idle')
      expect(race.speed).toBe(1)
    })

    it('ignores keys pressed inside an open dialog', () => {
      const { race } = setup()
      const dialog = document.body.appendChild(document.createElement('dialog'))
      const button = dialog.appendChild(document.createElement('button'))
      press('g', button)
      press('2', dialog)
      expect(race.status).toBe('idle')
      expect(race.speed).toBe(1)
    })

    it('leaves Space to a focused button, summary or link so it does not toggle twice', () => {
      const { race, generate } = setup()
      race.generate()
      for (const tag of ['summary', 'a']) {
        press(' ', document.body.appendChild(document.createElement(tag)))
      }
      press(' ', generate.element)
      expect(race.status).toBe('ready')
    })

    it('still handles letter shortcuts while a button has focus', () => {
      const { race, start } = setup()
      press('g', start.element)
      expect(race.status).toBe('ready')
    })

    it('stops listening once unmounted', () => {
      const { race, wrapper } = setup()
      wrapper.unmount()
      press('g')
      expect(race.status).toBe('idle')
    })
  })
})
