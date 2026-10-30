import { enableAutoUnmount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import App from '@/App.vue'
import { useLayoutStore } from '@/features/layout/stores/layout'
import { useTourStore } from '@/features/onboarding/stores/tour'
import { finishRound, mountWithRace } from '@/features/race/components/__tests__/mountWithRace'
import { useSettingsStore } from '@/features/race/stores/settings'

enableAutoUnmount(afterEach)
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({
    toFake: [
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'setTimeout',
      'clearTimeout',
    ],
  })
})
afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})

const titles = (wrapper: VueWrapper, column: 'left' | 'right') =>
  wrapper.findAll(`.column--${column} .panel__title`).map((t) => t.text())
const buttonByText = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text)!
const press = (target: Element, key: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

describe('App', () => {
  describe('shell', () => {
    it('renders the brand, setup pill, controls and tour button in the header', () => {
      const { wrapper } = mountWithRace(App)
      const header = wrapper.get('.app-header')
      expect(header.get('h1').attributes('aria-label')).toBe('Insider One')
      expect(header.get('img').attributes('alt')).toBe('')
      expect(header.get('[data-tour="setup"]').element.tagName).toBe('BUTTON')
      expect(header.get('[data-tour="controls"]').text()).toContain('Generate program')
      expect(header.get('[aria-label="Take the tour"]').attributes('title')).toBe('Take the tour')
    })

    it('puts header, track and standings in a labelled race section', () => {
      const { wrapper } = mountWithRace(App)
      const race = wrapper.get('section[aria-label="Race"]')
      expect(race.find('.race-header').exists()).toBe(true)
      expect(race.find('[data-tour="track"]').exists()).toBe(true)
      expect(race.get('[data-tour="standings"]').attributes('aria-label')).toBe('Live standings')
    })

    it('opens the tour from the header and pauses a running race', async () => {
      const { wrapper, race } = mountWithRace(App)
      race.start()
      await wrapper.get('[aria-label="Take the tour"]').trigger('click')
      await nextTick()
      expect(useTourStore().step).toBe(0)
      expect(wrapper.get<HTMLDialogElement>('dialog.tour').element.open).toBe(true)
      expect(race.status).toBe('paused')
    })

    it('opens the setup dialog from the summary pill', async () => {
      const { wrapper } = mountWithRace(App)
      await wrapper.get('[data-tour="setup"]').trigger('click')
      expect(wrapper.get<HTMLDialogElement>('dialog.setup').element.open).toBe(true)
    })
  })

  describe('panel layout', () => {
    it('renders the default columns from the layout store', () => {
      const { wrapper } = mountWithRace(App)
      expect(titles(wrapper, 'left')).toEqual(['Stable'])
      expect(titles(wrapper, 'right')).toEqual(['Program', 'Results'])
      expect(wrapper.findAll('.column [data-tour]').map((p) => p.attributes('data-tour'))).toEqual([
        'stable',
        'program',
        'results',
      ])
      expect(wrapper.find('.app-footer').exists()).toBe(false)
    })

    it('restores a saved layout', () => {
      localStorage.setItem(
        '1nsider:layout',
        JSON.stringify({ left: ['results', 'stable'], right: ['program'] }),
      )
      const { wrapper } = mountWithRace(App)
      expect(titles(wrapper, 'left')).toEqual(['Results', 'Stable'])
      expect(titles(wrapper, 'right')).toEqual(['Program'])
      expect(wrapper.get('.app-footer').text()).toBe('Reset layout')
    })

    it('ignores a broken saved layout', () => {
      localStorage.setItem('1nsider:layout', JSON.stringify({ left: ['stable'], right: [] }))
      const { wrapper } = mountWithRace(App)
      expect(titles(wrapper, 'right')).toEqual(['Program', 'Results'])
    })

    it('moves a panel by keyboard, keeps focus on its handle and announces it', async () => {
      const { wrapper } = mountWithRace(App)
      const help = wrapper.get('#layout-help')
      expect(help.classes()).toContain('sr-only')

      press(wrapper.get('[data-handle="stable"]').element, 'ArrowRight')
      await nextTick()
      vi.advanceTimersToNextFrame()

      expect(titles(wrapper, 'left')).toEqual([])
      expect(titles(wrapper, 'right')).toEqual(['Stable', 'Program', 'Results'])
      expect(document.activeElement).toBe(wrapper.get('[data-handle="stable"]').element)
      expect(wrapper.find('.app-footer').exists()).toBe(true)
      expect(wrapper.get('.app > p[aria-live="polite"]').text()).toBe(
        'Stable panel moved to the right column, position 1 of 3.',
      )

      const left = wrapper.get('.column--left')
      expect(left.classes()).toContain('is-empty')
      expect(left.attributes('data-empty-label')).toBe('Drop a panel here')
    })

    it('saves a drag-and-drop result to the layout store', async () => {
      const { wrapper } = mountWithRace(App)
      const [left, right] = wrapper.findAllComponents(VueDraggable)
      // What SortableJS reports after dragging Results above Stable in the left column.
      right!.vm.$emit('update:modelValue', ['program'])
      left!.vm.$emit('update:modelValue', ['results', 'stable'])
      await nextTick()
      expect(useLayoutStore().columns).toEqual({ left: ['results', 'stable'], right: ['program'] })
      expect(titles(wrapper, 'left')).toEqual(['Results', 'Stable'])
      expect(JSON.parse(localStorage.getItem('1nsider:layout')!).left).toEqual([
        'results',
        'stable',
      ])
    })

    it('resets the layout from the footer, which then hides', async () => {
      const { wrapper } = mountWithRace(App)
      useLayoutStore().move('results', 'left')
      await nextTick()
      expect(titles(wrapper, 'left')).toEqual(['Stable', 'Results'])

      await buttonByText(wrapper, 'Reset layout').trigger('click')
      expect(titles(wrapper, 'left')).toEqual(['Stable'])
      expect(titles(wrapper, 'right')).toEqual(['Program', 'Results'])
      expect(wrapper.find('.app-footer').exists()).toBe(false)
      expect(wrapper.text()).toContain('Panels are back in their default places.')
    })
  })

  describe('race day', () => {
    it('runs a round end to end through the real components', async () => {
      const { wrapper, race } = mountWithRace(App)
      await buttonByText(wrapper, 'Generate program').trigger('click')
      expect(wrapper.findAll('.rounds > li')).toHaveLength(6)
      expect(wrapper.findAll('.lane')).toHaveLength(10)

      await buttonByText(wrapper, 'Start the races').trigger('click')
      expect(wrapper.get('.start').text()).toBe('Pause')
      finishRound(race)
      await nextTick()

      expect(wrapper.findAll('.round-title').map((t) => t.text())).toContain('Round 1 · 1200m')
      expect(wrapper.get('[data-tour="results"] .panel__meta').text()).toBe('1 of 6')
      expect(wrapper.get('.race-header h2').text()).toBe('Round 2 · 1400m')
    })

    it('animates the race with requestAnimationFrame while it runs', async () => {
      const { race } = mountWithRace(App)
      race.start()
      await nextTick()
      vi.advanceTimersByTime(1000)
      expect(race.countdown).toBeCloseTo(2, 1)

      race.pause()
      await nextTick()
      vi.advanceTimersByTime(1000)
      expect(race.countdown).toBeCloseTo(2, 1)
    })

    it('ignores shortcuts typed inside the setup dialog', async () => {
      const { wrapper, race } = mountWithRace(App)
      useSettingsStore().isSetupOpen = true
      await nextTick()
      press(wrapper.get('#seed').element, 'g')
      press(wrapper.get('dialog.setup button').element, ' ')
      expect(race.status).toBe('idle')

      useSettingsStore().isSetupOpen = false
      await nextTick()
      press(document.body, 'g')
      expect(race.status).toBe('ready')
    })

    it('creates a custom race day from the dialog and shows it everywhere', async () => {
      const { wrapper, race } = mountWithRace(App)
      await wrapper.get('[data-tour="setup"]').trigger('click')
      for (let i = 0; i < 15; i++) {
        await wrapper.get('[aria-label="Decrease horses"]').trigger('click')
      }
      await wrapper.get('[aria-label="Decrease rounds"]').trigger('click')
      await buttonByText(wrapper, 'Create race day').trigger('click')

      expect(race.horses).toHaveLength(5)
      expect(wrapper.get('[data-tour="setup"]').text()).toContain('5 horses')
      expect(wrapper.get('[data-tour="setup"]').text()).toContain('5 rounds')
      expect(wrapper.get('[data-tour="stable"] .panel__meta').text()).toBe('5 horses')
      expect(wrapper.get('.notice p').text()).toBe(
        'Draw 5 of your 5 horses for each of the 5 rounds.',
      )
    })
  })
})
