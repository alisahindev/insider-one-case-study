import { enableAutoUnmount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountWithRace } from '@/features/race/components/__tests__/mountWithRace'
import { TOUR_STEPS } from '../../steps'
import { useTourStore } from '../../stores/tour'
import TourOverlay from '../TourOverlay.vue'

enableAutoUnmount(afterEach)
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

const CARD = { width: 300, height: 200 }
const settle = async () => {
  for (let i = 0; i < 3; i++) await nextTick()
}
const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
  }) as DOMRect

/** Page elements the steps point at, each with a mocked on-screen box. */
function addTargets() {
  const targets: Record<string, HTMLElement> = {}
  for (const name of ['setup', 'controls', 'track', 'standings', 'stable', 'results']) {
    targets[name] = document.body.appendChild(document.createElement('div'))
    targets[name].dataset.tour = name
  }
  targets.handle = targets.stable!.appendChild(document.createElement('button'))
  targets.handle.className = 'handle'
  for (const el of Object.values(targets)) {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(100, 100, 200, 50))
  }
  return targets
}

function mountTour({ racing = false } = {}) {
  const { race, wrapper } = mountWithRace(TourOverlay)
  if (racing) race.start()
  const card = wrapper.get('.card').element as HTMLElement
  Object.defineProperty(card, 'offsetWidth', { configurable: true, value: CARD.width })
  Object.defineProperty(card, 'offsetHeight', { configurable: true, value: CARD.height })
  return { race, wrapper, tour: useTourStore(), dialog: wrapper.get('dialog').element }
}

async function openAt(step: number, options?: Parameters<typeof mountTour>[0]) {
  const mounted = mountTour(options)
  mounted.tour.start()
  await settle()
  for (let i = 0; i < step; i++) mounted.tour.next()
  await settle()
  vi.advanceTimersToNextFrame() // the rAF loop measures the new step's target
  await settle()
  return mounted
}

const nextButton = (wrapper: VueWrapper) => wrapper.get('.btn--primary')
const backButton = (wrapper: VueWrapper) => wrapper.find('.btn--ghost')
const translate = (wrapper: VueWrapper, selector: string) =>
  (wrapper.get(selector).element as HTMLElement).style.transform
const keydown = (el: Element, key: string) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

describe('TourOverlay', () => {
  describe('steps and buttons', () => {
    it('stays closed until the tour starts', () => {
      const { dialog } = mountTour()
      expect(dialog.open).toBe(false)
      expect(dialog.getAttribute('aria-labelledby')).toBe('tour-title')
    })

    it('opens on the welcome step with focus on the main button', async () => {
      const { wrapper, dialog } = await openAt(0)
      expect(dialog.open).toBe(true)
      expect(wrapper.get('.count').text()).toBe('1 of 9')
      expect(wrapper.get('#tour-title').text()).toBe('Welcome to 1nsider')
      expect(wrapper.get('.card__text p').text()).toBe(TOUR_STEPS[0]!.body)
      expect(nextButton(wrapper).text()).toBe('Show me around')
      expect(backButton(wrapper).exists()).toBe(false)
      expect(wrapper.get('.skip').text()).toBe('Skip tour')
      expect(document.activeElement).toBe(nextButton(wrapper).element)
      expect(wrapper.findAll('.progress li.done')).toHaveLength(1)
      expect(wrapper.get('.progress').attributes('aria-hidden')).toBe('true')
      expect(wrapper.get('[aria-live="polite"]').text()).toBe(
        `Step 1 of 9. Welcome to 1nsider. ${TOUR_STEPS[0]!.body}`,
      )
    })

    it('walks forward and back with the buttons', async () => {
      const { wrapper, tour } = await openAt(0)
      await nextButton(wrapper).trigger('click')
      await settle()
      expect(tour.step).toBe(1)
      expect(wrapper.get('.count').text()).toBe('2 of 9')
      expect(wrapper.get('#tour-title').text()).toBe('Set up your race day')
      expect(nextButton(wrapper).text()).toBe('Next')
      expect(wrapper.findAll('.progress li.done')).toHaveLength(2)

      await backButton(wrapper).trigger('click')
      await settle()
      expect(tour.step).toBe(0)
      expect(backButton(wrapper).exists()).toBe(false)
    })

    it('walks with the arrow keys and stops at the first step', async () => {
      const { tour, dialog } = await openAt(0)
      keydown(dialog, 'ArrowLeft')
      expect(tour.step).toBe(0)
      keydown(dialog, 'ArrowRight')
      keydown(dialog, 'ArrowRight')
      expect(tour.step).toBe(2)
      keydown(dialog, 'ArrowLeft')
      expect(tour.step).toBe(1)
    })

    it('ends on "Start racing" without a Skip button, and finishing closes it for good', async () => {
      const { wrapper, tour, dialog } = await openAt(8)
      expect(wrapper.get('.count').text()).toBe('9 of 9')
      expect(wrapper.get('#tour-title').text()).toBe('You’re ready')
      expect(nextButton(wrapper).text()).toBe('Start racing')
      expect(wrapper.find('.skip').exists()).toBe(false)

      await nextButton(wrapper).trigger('click')
      expect(tour.step).toBeNull()
      expect(localStorage.getItem('1nsider:tour-seen')).toBe('1')
      expect(wrapper.get('dialog').classes()).toContain('is-leaving')
      // The last step stays on screen while the tour fades out.
      expect(wrapper.get('.count').text()).toBe('9 of 9')
      expect(dialog.open).toBe(true)
      vi.advanceTimersByTime(200)
      expect(dialog.open).toBe(false)
    })

    it('closes when the right arrow goes past the last step', async () => {
      const { tour, dialog } = await openAt(8)
      keydown(dialog, 'ArrowRight')
      expect(tour.step).toBeNull()
      await settle()
      vi.advanceTimersByTime(200)
      expect(dialog.open).toBe(false)
    })

    it('skips the tour and remembers it', async () => {
      const { wrapper, tour, dialog } = await openAt(3)
      await wrapper.get('.skip').trigger('click')
      expect(tour.step).toBeNull()
      expect(localStorage.getItem('1nsider:tour-seen')).toBe('1')
      vi.advanceTimersByTime(200)
      expect(dialog.open).toBe(false)
    })

    it('closes on Esc with its own fade-out instead of the instant native close', async () => {
      const { tour, dialog } = await openAt(2)
      const cancel = new Event('cancel', { cancelable: true })
      dialog.dispatchEvent(cancel)
      expect(cancel.defaultPrevented).toBe(true)
      expect(tour.step).toBeNull()
      expect(localStorage.getItem('1nsider:tour-seen')).toBe('1')
      await settle()
      expect(dialog.open).toBe(true)
      vi.advanceTimersByTime(200)
      expect(dialog.open).toBe(false)
    })
  })

  describe('reopening', () => {
    it('starts over from the welcome step', async () => {
      const { wrapper, tour, dialog } = await openAt(4)
      tour.close()
      await settle()
      vi.advanceTimersByTime(200)
      expect(dialog.open).toBe(false)

      tour.start()
      await settle()
      expect(dialog.open).toBe(true)
      expect(wrapper.get('.count').text()).toBe('1 of 9')
      expect(wrapper.get('dialog').classes()).not.toContain('is-leaving')
    })

    it('stays open when restarted while fading out', async () => {
      const { wrapper, tour, dialog } = await openAt(4)
      tour.close()
      await settle()
      vi.advanceTimersByTime(100)
      tour.start()
      await settle()
      vi.advanceTimersByTime(500)
      expect(dialog.open).toBe(true)
      expect(wrapper.get('dialog').classes()).not.toContain('is-leaving')
      expect(wrapper.get('.count').text()).toBe('1 of 9')
    })
  })

  describe('the race underneath', () => {
    it('pauses a running race so it does not run unwatched', async () => {
      const { race } = await openAt(0, { racing: true })
      expect(race.status).toBe('paused')
    })

    it('leaves an idle, ready or paused race as it is', async () => {
      const { race, tour } = mountTour()
      tour.start()
      await settle()
      expect(race.status).toBe('idle')

      tour.close()
      race.generate()
      tour.start()
      await settle()
      expect(race.status).toBe('ready')
    })
  })

  describe('focus', () => {
    it('moves focus to the main button when the focused Back button disappears', async () => {
      const { wrapper } = await openAt(1)
      const back = backButton(wrapper)
      ;(back.element as HTMLElement).focus()
      await back.trigger('click')
      await settle()
      expect(backButton(wrapper).exists()).toBe(false)
      expect(document.activeElement).toBe(nextButton(wrapper).element)
    })

    it('leaves focus alone while it is inside the card', async () => {
      const { wrapper } = await openAt(2)
      const back = backButton(wrapper).element as HTMLElement
      back.focus()
      await backButton(wrapper).trigger('click')
      await settle()
      expect(document.activeElement).toBe(back)
    })
  })

  describe('spotlight and card placement', () => {
    it('centres the card on a dimmed screen when a step has no target', async () => {
      const { wrapper } = await openAt(0)
      expect(translate(wrapper, '.hole')).toBe('translate(512px, 384px)')
      expect(wrapper.get('.hole').attributes('style')).toContain('width: 0px')
      expect(translate(wrapper, '.card')).toBe('translate(362px, 284px)')
      expect(wrapper.get('.hole').attributes('aria-hidden')).toBe('true')
    })

    it('cuts the spotlight around the target, with padding and matching corners', async () => {
      const targets = addTargets()
      targets.setup!.style.borderTopLeftRadius = '12px'
      const { wrapper } = await openAt(1)
      const hole = wrapper.get('.hole').element as HTMLElement
      expect(hole.style.transform).toBe('translate(92px, 92px)')
      expect(hole.style.width).toBe('216px')
      expect(hole.style.height).toBe('66px')
      expect(hole.style.borderRadius).toBe('20px')
      // Below the target, centred on it.
      expect(translate(wrapper, '.card')).toBe('translate(50px, 172px)')
    })

    it.each([
      ['above a target near the bottom', rect(400, 600, 200, 100), 'translate(350px, 378px)'],
      ['right of a tall target', rect(50, 10, 200, 740), 'translate(272px, 280px)'],
      ['left of a tall target on the right', rect(600, 10, 300, 740), 'translate(278px, 280px)'],
      ['inside a target that fills the screen', rect(10, 10, 1000, 740), 'translate(360px, 542px)'],
    ])('places the card %s', async (_, box, expected) => {
      const targets = addTargets()
      vi.mocked(targets.setup!.getBoundingClientRect).mockReturnValue(box)
      const { wrapper } = await openAt(1)
      expect(translate(wrapper, '.card')).toBe(expected)
    })

    it('docks the card to the bottom as a sheet on phones', async () => {
      vi.stubGlobal('innerWidth', 400)
      vi.stubGlobal('innerHeight', 800)
      addTargets()
      const { wrapper } = await openAt(1)
      expect(wrapper.get('.card').classes()).toContain('is-sheet')
      expect(translate(wrapper, '.card')).toBe('translate(16px, 584px)')
    })

    it('follows the target as it moves, frame by frame', async () => {
      const targets = addTargets()
      const { wrapper } = await openAt(1)
      vi.mocked(targets.setup!.getBoundingClientRect).mockReturnValue(rect(300, 200, 200, 50))
      vi.advanceTimersToNextFrame()
      await nextTick()
      expect(translate(wrapper, '.hole')).toBe('translate(292px, 192px)')
    })

    it('spotlights the first drag handle on the layout step', async () => {
      const targets = addTargets()
      vi.mocked(targets.handle!.getBoundingClientRect).mockReturnValue(rect(20, 300, 24, 24))
      const { wrapper } = await openAt(6)
      expect(wrapper.get('#tour-title').text()).toBe('Make the layout yours')
      expect(translate(wrapper, '.hole')).toBe('translate(12px, 292px)')
    })

    it('stops measuring once unmounted', async () => {
      const targets = addTargets()
      const { wrapper } = await openAt(1)
      const measure = vi.mocked(targets.setup!.getBoundingClientRect)
      wrapper.unmount()
      const calls = measure.mock.calls.length
      vi.advanceTimersByTime(1000)
      expect(measure.mock.calls.length).toBe(calls)
    })

    it('glides to a new step but lands the first placement without a glide', async () => {
      addTargets()
      const { wrapper, tour } = await openAt(0)
      expect(wrapper.get('dialog').classes()).not.toContain('is-moving')
      tour.next()
      await settle()
      expect(wrapper.get('dialog').classes()).toContain('is-moving')
      vi.advanceTimersByTime(450)
      await nextTick()
      expect(wrapper.get('dialog').classes()).not.toContain('is-moving')
    })
  })

  describe('scrolling targets into view', () => {
    it('smooth-scrolls to centre a target that is off screen', async () => {
      const targets = addTargets()
      vi.mocked(targets.track!.getBoundingClientRect).mockReturnValue(rect(0, 900, 800, 400))
      const scroll = vi.spyOn(window, 'scrollBy')
      await openAt(3)
      expect(scroll).toHaveBeenCalledWith({ top: 900 + 200 - 384, behavior: 'smooth' })
    })

    it('jumps instead when the user prefers reduced motion', async () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
      const targets = addTargets()
      vi.mocked(targets.track!.getBoundingClientRect).mockReturnValue(rect(0, -500, 800, 400))
      const scroll = vi.spyOn(window, 'scrollBy')
      await openAt(3)
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
      expect(scroll).toHaveBeenCalledWith({ top: -500 + 200 - 384, behavior: 'auto' })
    })

    it('leaves a visible target where it is', async () => {
      addTargets()
      const scroll = vi.spyOn(window, 'scrollBy')
      await openAt(3)
      expect(scroll).not.toHaveBeenCalled()
    })

    it('does not scroll for steps without a target', async () => {
      const scroll = vi.spyOn(window, 'scrollBy')
      await openAt(8)
      expect(scroll).not.toHaveBeenCalled()
    })

    it('lifts the target above the docked card on phones', async () => {
      vi.stubGlobal('innerWidth', 400)
      vi.stubGlobal('innerHeight', 800)
      const targets = addTargets()
      // Visible on a desktop, but hidden behind the sheet on a phone (below 55% of the height).
      vi.mocked(targets.track!.getBoundingClientRect).mockReturnValue(rect(0, 500, 400, 100))
      const scroll = vi.spyOn(window, 'scrollBy')
      await openAt(3)
      expect(scroll).toHaveBeenCalledWith({ top: 500 - 72, behavior: 'smooth' })
    })
  })
})
