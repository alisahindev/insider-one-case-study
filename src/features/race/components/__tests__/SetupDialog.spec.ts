import { enableAutoUnmount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useThemeStore } from '@/shared/stores/theme'
import { DEFAULT_SETTINGS } from '../../domain/settings'
import { useSettingsStore } from '../../stores/settings'
import SetupDialog from '../SetupDialog.vue'
import { mountWithRace, tickUntil } from './mountWithRace'

enableAutoUnmount(afterEach)
beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})
afterEach(() => vi.restoreAllMocks())

async function openSetup(...args: Parameters<typeof mountWithRace>) {
  const mounted = mountWithRace(...args)
  const setup = useSettingsStore()
  setup.isSetupOpen = true
  await nextTick()
  const { wrapper } = mounted
  return {
    ...mounted,
    setup,
    dialog: wrapper.get('dialog'),
    seed: wrapper.get<HTMLInputElement>('#seed'),
    tip: wrapper.get('.info__button'),
    bubble: wrapper.get('#seed-help'),
  }
}

const button = (wrapper: VueWrapper, label: string) => wrapper.get(`[aria-label="${label}"]`)
const value = (wrapper: VueWrapper, group: string) =>
  wrapper.get(`[role="group"][aria-label="${group}"] output`).text()
const distances = (wrapper: VueWrapper) => wrapper.findAll('.distances output').map((o) => o.text())
const clickTimes = async (wrapper: VueWrapper, label: string, times: number) => {
  for (let i = 0; i < times; i++) await button(wrapper, label).trigger('click')
}
const create = (wrapper: VueWrapper) => wrapper.get('button[type="submit"]').trigger('click')

describe('SetupDialog', () => {
  describe('opening and closing', () => {
    it('stays closed until the settings store asks for it', async () => {
      const { wrapper } = mountWithRace(SetupDialog)
      const dialog = wrapper.get<HTMLDialogElement>('dialog')
      expect(dialog.element.open).toBe(false)

      useSettingsStore().isSetupOpen = true
      await nextTick()
      expect(dialog.element.open).toBe(true)
      expect(dialog.attributes('aria-labelledby')).toBe('setup-title')
      expect(wrapper.get('#setup-title').text()).toBe('New race day')
    })

    it('fills the form from the race day on screen, not only the saved choices', async () => {
      // A deep link can open a day that differs from what was saved last time.
      localStorage.setItem('1nsider:settings', JSON.stringify({ horseCount: 20 }))
      const { wrapper } = await openSetup(SetupDialog, {
        settings: {
          horseCount: 8,
          horsesPerRound: 4,
          distances: [1000, 1600],
          countdown: false,
          speed: 2,
        },
      })
      expect(value(wrapper, 'horses')).toBe('8')
      expect(value(wrapper, 'horses per round')).toBe('4')
      expect(value(wrapper, 'rounds')).toBe('2')
      expect(distances(wrapper)).toEqual(['1000m', '1600m'])
      expect(wrapper.get<HTMLInputElement>('[role="switch"]').element.checked).toBe(false)
      const speeds = wrapper.findAll<HTMLInputElement>('input[name="speed"]')
      expect(speeds.map((r) => r.element.checked)).toEqual([false, true, false])
    })

    it('closes from the close button', async () => {
      const { wrapper, setup, dialog } = await openSetup(SetupDialog)
      await button(wrapper, 'Close').trigger('click')
      expect(setup.isSetupOpen).toBe(false)
      expect((dialog.element as HTMLDialogElement).open).toBe(false)
    })

    it('closes on a backdrop click but not on a click inside the form', async () => {
      const { wrapper, setup, dialog } = await openSetup(SetupDialog)
      await wrapper.get('#setup-title').trigger('pointerdown')
      await wrapper.get('#setup-title').trigger('click')
      expect(setup.isSetupOpen).toBe(true)

      await dialog.trigger('pointerdown')
      await dialog.trigger('click')
      expect(setup.isSetupOpen).toBe(false)
      expect((dialog.element as HTMLDialogElement).open).toBe(false)
    })

    it('stays open when a press starts inside the form and ends on the backdrop', async () => {
      // e.g. selecting the seed text and letting go outside the box
      const { setup, dialog, seed } = await openSetup(SetupDialog)
      await seed.trigger('pointerdown')
      await dialog.trigger('click')
      expect(setup.isSetupOpen).toBe(true)
    })

    it('pauses a running race while it is open', async () => {
      const { race } = mountWithRace(SetupDialog)
      race.start()
      useSettingsStore().isSetupOpen = true
      await nextTick()
      expect(race.status).toBe('paused')
    })

    it('syncs the store when the browser closes it (Esc)', async () => {
      const { setup, dialog } = await openSetup(SetupDialog)
      ;(dialog.element as HTMLDialogElement).close()
      expect(setup.isSetupOpen).toBe(false)
    })

    it('discards unsaved edits, the seed and the open tip when opened again', async () => {
      const { wrapper, setup, seed, tip, bubble, race } = await openSetup(SetupDialog)
      await button(wrapper, 'Decrease horses').trigger('click')
      await button(wrapper, 'Increase rounds').trigger('click')
      await seed.setValue('42')
      await tip.trigger('click')
      await button(wrapper, 'Close').trigger('click')

      setup.isSetupOpen = true
      await nextTick()
      expect(value(wrapper, 'horses')).toBe('20')
      expect(value(wrapper, 'rounds')).toBe('6')
      expect(seed.element.value).toBe('')
      expect(bubble.isVisible()).toBe(false)
      expect(setup.settings).toEqual(DEFAULT_SETTINGS)
      expect(race.settings.horseCount).toBe(20)
    })

    it('edits a copy, so saved distances stay untouched until Create', async () => {
      const { wrapper, setup } = await openSetup(SetupDialog)
      await button(wrapper, 'Increase round 1 distance').trigger('click')
      await button(wrapper, 'Increase rounds').trigger('click')
      expect(distances(wrapper).slice(0, 1)).toEqual(['1400m'])
      expect(setup.settings.distances).toEqual(DEFAULT_SETTINGS.distances)
    })
  })

  describe('horses', () => {
    it('stops at 20 horses and at one horse', async () => {
      const { wrapper } = await openSetup(SetupDialog)
      expect(button(wrapper, 'Increase horses').attributes('disabled')).toBeDefined()
      await clickTimes(wrapper, 'Decrease horses', 19)
      expect(value(wrapper, 'horses')).toBe('1')
      expect(button(wrapper, 'Decrease horses').attributes('disabled')).toBeDefined()
      expect(button(wrapper, 'Increase horses').attributes('disabled')).toBeUndefined()
    })

    it('never lets the field outnumber the stable', async () => {
      const { wrapper } = await openSetup(SetupDialog)
      await clickTimes(wrapper, 'Decrease horses', 15)
      expect(value(wrapper, 'horses per round')).toBe('5')
      expect(button(wrapper, 'Increase horses per round').attributes('disabled')).toBeDefined()

      // Growing the stable again keeps the smaller field.
      await button(wrapper, 'Increase horses').trigger('click')
      expect(value(wrapper, 'horses per round')).toBe('5')
      expect(button(wrapper, 'Increase horses per round').attributes('disabled')).toBeUndefined()
    })

    it('runs a single-horse day', async () => {
      const { wrapper, race } = await openSetup(SetupDialog)
      await clickTimes(wrapper, 'Decrease horses', 19)
      expect(value(wrapper, 'horses per round')).toBe('1')
      expect(button(wrapper, 'Decrease horses per round').attributes('disabled')).toBeDefined()
      await create(wrapper)
      expect(race.horses).toHaveLength(1)
      expect(race.settings.horsesPerRound).toBe(1)
    })
  })

  describe('rounds and distances', () => {
    it('adds rounds 200m longer than the last and drops them from the end', async () => {
      const { wrapper } = await openSetup(SetupDialog)
      await clickTimes(wrapper, 'Increase rounds', 4)
      expect(value(wrapper, 'rounds')).toBe('10')
      expect(distances(wrapper).slice(6)).toEqual(['2400m', '2600m', '2800m', '3000m'])
      expect(wrapper.findAll('.distances li')[9]!.text()).toContain('Round 10')
      expect(button(wrapper, 'Increase rounds').attributes('disabled')).toBeDefined()

      await clickTimes(wrapper, 'Decrease rounds', 9)
      expect(distances(wrapper)).toEqual(['1200m'])
      expect(button(wrapper, 'Decrease rounds').attributes('disabled')).toBeDefined()
    })

    it('caps a new round at the longest distance', async () => {
      const { wrapper } = await openSetup(SetupDialog)
      await clickTimes(wrapper, 'Decrease rounds', 5)
      await clickTimes(wrapper, 'Increase round 1 distance', 10)
      expect(distances(wrapper)).toEqual(['3200m'])
      expect(button(wrapper, 'Increase round 1 distance').attributes('disabled')).toBeDefined()

      await button(wrapper, 'Increase rounds').trigger('click')
      expect(distances(wrapper)).toEqual(['3200m', '3200m'])
    })

    it('steps each distance by 200m between 400m and 3200m', async () => {
      const { wrapper } = await openSetup(SetupDialog)
      await clickTimes(wrapper, 'Decrease round 1 distance', 4)
      expect(distances(wrapper)[0]).toBe('400m')
      expect(button(wrapper, 'Decrease round 1 distance').attributes('disabled')).toBeDefined()
      await button(wrapper, 'Increase round 6 distance').trigger('click')
      expect(distances(wrapper)[5]).toBe('2400m')
    })

    it('creates a ten-round day with the edited distances', async () => {
      const { wrapper, race } = await openSetup(SetupDialog)
      await clickTimes(wrapper, 'Increase rounds', 4)
      await button(wrapper, 'Decrease round 2 distance').trigger('click')
      await create(wrapper)
      expect(race.roundCount).toBe(10)
      expect(race.settings.distances).toEqual([
        1200, 1200, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000,
      ])
    })
  })

  describe('countdown, speed and appearance', () => {
    it('toggles the countdown switch', async () => {
      const { wrapper, race } = await openSetup(SetupDialog)
      const toggle = wrapper.get<HTMLInputElement>('[role="switch"]')
      expect(toggle.attributes('aria-labelledby')).toBe('countdown-label')
      expect(wrapper.get('#countdown-label').text()).toBe('Countdown')
      expect(toggle.element.checked).toBe(true)

      await toggle.setValue(false)
      await create(wrapper)
      expect(race.settings.countdown).toBe(false)
    })

    it('sets the starting speed', async () => {
      const { wrapper, race, setup } = await openSetup(SetupDialog)
      const group = wrapper.get('[aria-labelledby="speed-label"]')
      expect(group.attributes('role')).toBe('radiogroup')
      expect(group.findAll('span').map((s) => s.text())).toEqual(['1×', '2×', '4×'])

      await group.findAll('input')[2]!.setValue()
      await create(wrapper)
      expect(race.speed).toBe(4)
      expect(setup.settings.speed).toBe(4)
    })

    it('applies the appearance right away, without Create', async () => {
      const { wrapper, setup } = await openSetup(SetupDialog)
      const group = wrapper.get('[aria-labelledby="theme-label"]')
      expect(group.attributes('role')).toBe('radiogroup')
      expect(group.findAll('span').map((s) => s.text())).toEqual(['System', 'Light', 'Dark'])
      expect(group.get<HTMLInputElement>('input').element.checked).toBe(true)

      await group.findAll('input')[2]!.setValue()
      expect(useThemeStore().theme).toBe('dark')
      expect(document.documentElement.dataset.theme).toBe('dark')

      await button(wrapper, 'Close').trigger('click')
      expect(useThemeStore().theme).toBe('dark')
      expect(setup.settings).toEqual(DEFAULT_SETTINGS)
    })
  })

  describe('seed toggletip', () => {
    it('is a labelled toggle that controls the help text', async () => {
      const { tip, bubble } = await openSetup(SetupDialog)
      expect(tip.attributes()).toMatchObject({
        'aria-label': 'What is a seed?',
        'aria-controls': 'seed-help',
        'aria-expanded': 'false',
      })
      expect(bubble.isVisible()).toBe(false)
      expect(bubble.attributes('role')).toBe('status')
    })

    it('opens and closes on click and names the current seed', async () => {
      const { tip, bubble, race } = await openSetup(SetupDialog)
      await tip.trigger('click')
      expect(tip.attributes('aria-expanded')).toBe('true')
      expect(bubble.isVisible()).toBe(true)
      expect(bubble.get('b').text()).toBe(String(race.seed))

      await tip.trigger('click')
      expect(tip.attributes('aria-expanded')).toBe('false')
      expect(bubble.isVisible()).toBe(false)
    })

    it('closes when focus leaves it', async () => {
      const { tip, bubble } = await openSetup(SetupDialog)
      await tip.trigger('click')
      await tip.trigger('blur')
      expect(bubble.isVisible()).toBe(false)
    })

    it('closes on Esc without closing the dialog', async () => {
      const { tip, bubble, dialog, setup } = await openSetup(SetupDialog)
      const reachedDialog = vi.fn<(event: Event) => void>()
      dialog.element.addEventListener('keydown', reachedDialog)
      await tip.trigger('click')

      const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      tip.element.dispatchEvent(esc)
      await nextTick()

      expect(bubble.isVisible()).toBe(false)
      expect(esc.defaultPrevented).toBe(true)
      expect(reachedDialog).not.toHaveBeenCalled()
      expect(setup.isSetupOpen).toBe(true)
    })

    it('lets Esc through to the dialog when the tip is already closed', async () => {
      const { tip, dialog } = await openSetup(SetupDialog)
      const reachedDialog = vi.fn<(event: Event) => void>()
      dialog.element.addEventListener('keydown', reachedDialog)

      const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      tip.element.dispatchEvent(esc)

      expect(esc.defaultPrevented).toBe(false)
      expect(reachedDialog).toHaveBeenCalled()
    })
  })

  describe('seed input', () => {
    it('is a labelled, numeric, six-digit field', async () => {
      const { wrapper, seed } = await openSetup(SetupDialog)
      expect(wrapper.get('label[for="seed"]').text()).toBe('Seed')
      expect(seed.attributes()).toMatchObject({
        inputmode: 'numeric',
        pattern: '\\d{1,6}',
        maxlength: '6',
        placeholder: 'Random',
      })
    })

    it('replays the typed seed exactly', async () => {
      const { wrapper, seed, race } = await openSetup(SetupDialog)
      await seed.setValue('4821')
      await create(wrapper)
      expect(race.seed).toBe(4821)
      expect(race.settings.seed).toBe(4821)
    })

    it('trims surrounding spaces', async () => {
      const { wrapper, seed, race } = await openSetup(SetupDialog)
      await seed.setValue(' 77 ')
      await seed.trigger('change') // the browser fires change on blur, before the click lands
      await create(wrapper)
      expect(race.seed).toBe(77)
    })

    it('draws a fresh random seed for every race day when left empty', async () => {
      const { wrapper, setup, race } = await openSetup(SetupDialog)
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.111111).mockReturnValueOnce(0.222222)
      await create(wrapper)
      expect(race.seed).toBe(111111)

      setup.isSetupOpen = true
      await nextTick()
      await create(wrapper)
      expect(race.seed).toBe(222222)
      expect(race.settings.seed).toBeNull()
    })

    it('never remembers a seed between visits', async () => {
      const { wrapper, seed } = await openSetup(SetupDialog)
      await seed.setValue('4821')
      await create(wrapper)
      expect(JSON.parse(localStorage.getItem('1nsider:settings')!).seed).toBeNull()
    })

    it.each(['abc', '12.5', '-3', '1234567'])('refuses to create a day from "%s"', async (text) => {
      const { wrapper, seed, race, setup } = await openSetup(SetupDialog)
      const before = race.horses
      await seed.setValue(text)
      expect(seed.element.validity.valid).toBe(false)

      await create(wrapper)
      expect(setup.isSetupOpen).toBe(true)
      expect(race.seed).toBe(1)
      expect(race.horses).toBe(before)
      expect(localStorage.getItem('1nsider:settings')).toBeNull()
    })
  })

  describe('reset and create', () => {
    it('resets the form to the assignment defaults without saving', async () => {
      localStorage.setItem('1nsider:settings', JSON.stringify({ horseCount: 6, horsesPerRound: 3 }))
      const { wrapper, seed, setup } = await openSetup(SetupDialog)
      await button(wrapper, 'Decrease rounds').trigger('click')
      await seed.setValue('9')

      await wrapper.get('.btn--ghost').trigger('click')
      expect(value(wrapper, 'horses')).toBe('20')
      expect(value(wrapper, 'horses per round')).toBe('10')
      expect(distances(wrapper)).toEqual(['1200m', '1400m', '1600m', '1800m', '2000m', '2200m'])
      expect(seed.element.value).toBe('')
      expect(setup.settings.horseCount).toBe(6)
    })

    it('saves the settings, starts a new race day and closes', async () => {
      const { wrapper, race, setup, dialog } = await openSetup(SetupDialog)
      await clickTimes(wrapper, 'Decrease horses', 8)
      await clickTimes(wrapper, 'Decrease horses per round', 4)
      await create(wrapper)

      const expected = { ...DEFAULT_SETTINGS, horseCount: 12, horsesPerRound: 6 }
      expect(setup.settings).toEqual(expected)
      expect(JSON.parse(localStorage.getItem('1nsider:settings')!)).toEqual(expected)
      expect(race.settings).toEqual(expected)
      expect(race.horses).toHaveLength(12)
      expect(race.status).toBe('idle')
      expect(setup.isSetupOpen).toBe(false)
      expect((dialog.element as HTMLDialogElement).open).toBe(false)
    })

    it('replaces a race day that is under way', async () => {
      const { wrapper, race, setup } = await openSetup(SetupDialog)
      race.start()
      tickUntil(race, () => race.results.length === 1, 1)
      setup.isSetupOpen = true
      await nextTick()

      await create(wrapper)
      expect(race.status).toBe('idle')
      expect(race.results).toEqual([])
      expect(race.schedule).toEqual([])
    })
  })
})
