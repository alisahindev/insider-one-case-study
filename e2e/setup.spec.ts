import { expect, test, type Page } from '@playwright/test'
import {
  RACE_DAY,
  SEED,
  finishRaceDay,
  finishingOrder,
  horses,
  openRaceDay,
  program,
  raceUntilResults,
  reload,
  resultTitles,
  runnerOffsets,
  seedStorage,
  settle,
  skipTour,
  stepper,
  tick,
  ui,
  visit,
} from './fixtures'

const DARK = 'rgb(18, 18, 18)'
const LIGHT = 'rgb(255, 255, 255)'
const pageBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor)

async function openSetup(page: Page) {
  await ui(page).summary.click()
  await expect(ui(page).setup).toBeVisible()
  return ui(page).setup
}

async function createRaceDay(page: Page) {
  await ui(page).setup.getByRole('button', { name: 'Create race day' }).click()
  await expect(ui(page).setup).toBeHidden()
}

test.describe('setup dialog', () => {
  test.beforeEach(({ page }) => openRaceDay(page))

  test('never opens by itself, on a deep link or a plain visit', async ({ page }) => {
    await expect(ui(page).setup).toBeHidden()
    await skipTour(page)
    await visit(page, '/')
    await expect(ui(page).setup).toBeHidden()
  })

  test('closes with the close button, Esc or a backdrop click and drops unsaved edits', async ({
    page,
  }) => {
    const { summary } = ui(page)
    await expect(summary).toHaveAccessibleName(
      /^20 horses\s*6 rounds\s*10 per round\s*, change race day settings$/,
    )
    const close = [
      (dialog: ReturnType<typeof ui>['setup']) =>
        dialog.getByRole('button', { name: 'Close' }).click(),
      () => page.keyboard.press('Escape'),
      () => page.mouse.click(4, 4), // the backdrop, outside the dialog box
    ]
    for (const closeWith of close) {
      const dialog = await openSetup(page)
      await stepper(dialog, 'horses').set(5)
      await closeWith(dialog)
      await expect(dialog).toBeHidden()
      await expect(summary).toContainText('20 horses')
      await openSetup(page)
      await expect(stepper(dialog, 'horses').value).toHaveText('20')
      await page.keyboard.press('Escape')
    }
    await expect(ui(page).stable.getByRole('meter')).toHaveCount(20)
  })

  test('steppers stay within their limits and per round never exceeds the stable', async ({
    page,
  }) => {
    const dialog = await openSetup(page)
    const horsesStepper = stepper(dialog, 'horses')
    const perRound = stepper(dialog, 'horses per round')
    const rounds = stepper(dialog, 'rounds')

    await expect(horsesStepper.increase).toBeDisabled() // 20 is the most
    await expect(perRound.value).toHaveText('10')
    await horsesStepper.set(6)
    await expect(perRound.value).toHaveText('6') // follows the stable down
    await expect(perRound.increase).toBeDisabled()
    await horsesStepper.set(1)
    await expect(horsesStepper.decrease).toBeDisabled()
    await expect(perRound.value).toHaveText('1')
    await expect(perRound.decrease).toBeDisabled()

    // Adding a round appends one 200m longer than the last; removing drops it from the end.
    await rounds.set(7)
    await expect(stepper(dialog, 'round 7 distance').value).toHaveText('2400m')
    await rounds.set(10)
    await expect(rounds.increase).toBeDisabled()
    await expect(stepper(dialog, 'round 10 distance').value).toHaveText('3000m')
    await rounds.set(1)
    await expect(rounds.decrease).toBeDisabled()
    await expect(dialog.getByRole('group', { name: /^round \d+ distance$/ })).toHaveCount(1)

    const distance = stepper(dialog, 'round 1 distance')
    await distance.increase.click()
    await expect(distance.value).toHaveText('1400m') // 200m steps
    await distance.set(400)
    await expect(distance.decrease).toBeDisabled()
    await distance.set(3200)
    await expect(distance.increase).toBeDisabled()
  })

  test('Reset to defaults brings back the assessment settings', async ({ page }) => {
    const dialog = await openSetup(page)
    await stepper(dialog, 'horses').set(4)
    await stepper(dialog, 'rounds').set(2)
    await dialog.getByRole('switch', { name: 'Countdown' }).uncheck()
    await dialog.getByRole('radio', { name: '4×' }).check()
    await dialog.getByRole('textbox', { name: 'Seed' }).fill('123')

    await dialog.getByRole('button', { name: 'Reset to defaults' }).click()
    await expect(stepper(dialog, 'horses').value).toHaveText('20')
    await expect(stepper(dialog, 'horses per round').value).toHaveText('10')
    await expect(stepper(dialog, 'rounds').value).toHaveText('6')
    const distances = dialog.getByRole('group', { name: /^round \d+ distance$/ }).locator('output')
    await expect(distances).toHaveText(['1200m', '1400m', '1600m', '1800m', '2000m', '2200m'])
    await expect(dialog.getByRole('switch', { name: 'Countdown' })).toBeChecked()
    await expect(dialog.getByRole('radio', { name: '1×' })).toBeChecked()
    await expect(dialog.getByRole('textbox', { name: 'Seed' })).toHaveValue('')
  })

  test('"What is a seed?" explains seeds and shows this day\'s seed', async ({ page }) => {
    const dialog = await openSetup(page)
    const info = dialog.getByRole('button', { name: 'What is a seed?' })
    const tip = dialog.locator('#seed-help')
    await expect(info).toHaveAttribute('aria-expanded', 'false')
    await expect(tip).toBeHidden()

    await info.click()
    await expect(info).toHaveAttribute('aria-expanded', 'true')
    await expect(tip).toBeVisible()
    await expect(tip).toContainText(`This race day's seed is ${SEED}.`)

    await page.keyboard.press('Escape') // closes the tip, not the dialog
    await expect(tip).toBeHidden()
    await expect(dialog).toBeVisible()

    await info.click()
    await page.keyboard.press('Tab') // moving focus away closes it too
    await expect(tip).toBeHidden()
  })

  test('a 5 horse × 3 round day: smaller field, fewer rounds, raced to the end', async ({
    page,
  }) => {
    test.slow()
    const dialog = await openSetup(page)
    await stepper(dialog, 'horses').set(5)
    await stepper(dialog, 'rounds').set(3)
    await expect(stepper(dialog, 'horses per round').value).toHaveText('5')
    await createRaceDay(page)
    await settle(page) // the 15 leaving rows fade out on frames of the paused clock

    await expect(ui(page).summary).toHaveAccessibleName(/^5 horses\s*3 rounds\s*5 per round/)
    await expect(ui(page).stable.getByRole('meter')).toHaveCount(5)
    await ui(page).generate.click()
    const rounds = await program(page)
    expect(rounds.map((r) => r.title)).toEqual([
      'Round 1 · 1200m',
      'Round 2 · 1400m',
      'Round 3 · 1600m',
    ])
    for (const round of rounds) expect(new Set(round.entrants).size).toBe(5)
    await expect(page.locator('.runner')).toHaveCount(5)

    await finishRaceDay(page, 3)
    await expect(ui(page).results).toContainText('3 of 3')
    await expect(ui(page).results.getByText('All 5 finishers')).toHaveCount(3)
  })

  test('a one horse, one round day still races and reports a result', async ({ page }) => {
    await visit(page, '/?seed=1&horses=1&distances=1200') // on the same paused clock
    await expect(ui(page).summary).toHaveAccessibleName(/^1 horse\s*1 round\s*1 per round/)
    await expect(ui(page).stable.getByRole('meter')).toHaveCount(1)
    await expect(ui(page).stable).toContainText('1 horse')
    await expect(ui(page).race).toContainText('Draw 1 of your 1 horse for the one round.')

    await ui(page).generate.click()
    await settle(page)
    await expect(ui(page).race).toContainText('One round of 1200m.')
    await ui(page).start.click()
    await tick(page, 4_000)
    await expect(ui(page).liveClock).toHaveText(/^1 runner · /)
    await finishRaceDay(page, 1)
    const [winner] = await horses(page)
    expect(await finishingOrder(page, 1)).toEqual([winner!.name])
    await expect(ui(page).results).toContainText('1 of 1')
    await expect(ui(page).results.getByText(/All \d+ finishers/)).toHaveCount(0) // podium only
    await expect(ui(page).race.getByRole('list', { name: '1 of 1 rounds finished' })).toBeAttached()
  })

  test('a 20 horse × 10 round day with a full field of 20 per round', async ({ page }) => {
    test.setTimeout(150_000) // ten long rounds of twenty runners on the fake clock
    const dialog = await openSetup(page)
    await stepper(dialog, 'rounds').set(10)
    await stepper(dialog, 'horses per round').set(20)
    await createRaceDay(page)

    await expect(ui(page).summary).toHaveAccessibleName(/^20 horses\s*10 rounds\s*20 per round/)
    await ui(page).generate.click()
    const rounds = await program(page)
    expect(rounds.map((r) => r.title)).toEqual(
      Array.from({ length: 10 }, (_, i) => `Round ${i + 1} · ${1200 + i * 200}m`),
    )
    for (const round of rounds) expect(new Set(round.entrants).size).toBe(20)
    await expect(page.locator('.runner')).toHaveCount(20)

    await finishRaceDay(page, 10)
    await expect(ui(page).results).toContainText('10 of 10')
    await expect(ui(page).results.getByText('All 20 finishers')).toHaveCount(10)
  })

  test('horses per round larger than the stable is clamped to the stable', async ({ page }) => {
    await visit(page, `/?seed=${SEED}&horses=5&perRound=10`)
    await expect(ui(page).summary).toHaveAccessibleName(/^5 horses\s*6 rounds\s*5 per round/)
    await ui(page).generate.click()
    for (const round of await program(page)) expect(new Set(round.entrants).size).toBe(5)
  })

  test('countdown off: every round starts straight away', async ({ page }) => {
    const dialog = await openSetup(page)
    await dialog.getByRole('switch', { name: 'Countdown' }).uncheck()
    await createRaceDay(page)

    const { start, speed, countdown } = ui(page)
    await start.click()
    await tick(page, 500)
    await expect(countdown).toHaveCount(0)
    expect(Math.min(...(await runnerOffsets(page)))).toBeGreaterThan(0)

    await speed(4).click()
    for (let i = 0; i < 80 && (await resultTitles(page).count()) < 2; i++) {
      await tick(page, 250)
      await expect(countdown).toHaveCount(0)
    }
    await expect(resultTitles(page)).toHaveCount(2)
  })

  test('the starting speed chosen in setup is the speed the day starts at', async ({ page }) => {
    const dialog = await openSetup(page)
    await dialog.getByRole('radio', { name: '4×' }).check()
    await createRaceDay(page)
    await expect(ui(page).speed(4)).toHaveAttribute('aria-pressed', 'true')
    await expect(ui(page).speed(1)).toHaveAttribute('aria-pressed', 'false')
  })
})

test.describe('setup dialog at a short viewport', () => {
  test('only the dialog body scrolls; header and footer stay in view', async ({
    page,
    isMobile,
    browserName,
  }) => {
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 480 })
    await visit(page)
    const dialog = await openSetup(page)
    await stepper(dialog, 'rounds').set(10) // a long form
    const body = dialog.locator('.setup__body')
    const pageScroll = await page.evaluate(() => scrollY)

    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
    if (browserName === 'webkit' && isMobile) {
      await body.evaluate((el) => el.scrollTo(0, el.scrollHeight)) // mobile WebKit has no wheel
    } else {
      await body.hover()
      // Several notches: Firefox caps how far a single wheel event scrolls.
      for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 500)
    }
    await expect(dialog.getByRole('textbox', { name: 'Seed' })).toBeInViewport() // scrolled to the end
    await expect(dialog.getByRole('heading', { name: 'New race day' })).toBeInViewport()
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeInViewport()
    await expect(dialog.getByRole('button', { name: 'Create race day' })).toBeInViewport()
    await expect(dialog.getByRole('button', { name: 'Reset to defaults' })).toBeInViewport()
    expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    expect(await dialog.evaluate((el) => el.scrollTop)).toBe(0)
    expect(await page.evaluate(() => scrollY)).toBe(pageScroll)
  })
})

test.describe('seeds', () => {
  test('the same seed replays the same day on another page load: horses, program, results', async ({
    page,
    context,
  }) => {
    test.slow()
    const record = async (p: Page) => {
      await openRaceDay(p)
      const stable = await horses(p)
      await ui(p).generate.click()
      const schedule = await program(p)
      await ui(p).speed(4).click()
      await ui(p).start.click()
      await raceUntilResults(p, 2)
      return {
        stable,
        schedule,
        round1: await finishingOrder(p, 1),
        round2: await finishingOrder(p, 2),
      }
    }
    const first = await record(page)
    const second = await record(await context.newPage())
    expect(second).toEqual(first)
    expect(first.round1).toHaveLength(10)
  })

  test('deep link options set the stable, field size and distances, cleaned up when out of range', async ({
    page,
  }) => {
    await visit(page, '/?seed=5&horses=8&perRound=4&distances=1250,9999')
    await expect(ui(page).summary).toHaveAccessibleName(/^8 horses\s*2 rounds\s*4 per round/)
    await ui(page).generate.click()
    const rounds = await program(page)
    expect(rounds.map((r) => r.title)).toEqual(['Round 1 · 1200m', 'Round 2 · 3200m'])
    for (const round of rounds) expect(round.entrants).toHaveLength(4)

    // Empty entries are dropped; an empty list falls back to the six standard rounds.
    await visit(page, '/?seed=5&distances=1400,,1600,')
    await expect(ui(page).summary).toHaveAccessibleName(/^20 horses\s*2 rounds/)
    await visit(page, '/?seed=5&distances=')
    await expect(ui(page).summary).toHaveAccessibleName(/^20 horses\s*6 rounds\s*10 per round/)
  })

  test('a typed seed builds the same race day as its deep link', async ({ page }) => {
    await visit(page, '/?seed=777')
    const deepLinked = await horses(page)

    await visit(page, RACE_DAY)
    const dialog = await openSetup(page)
    await dialog.getByRole('textbox', { name: 'Seed' }).fill('777')
    await createRaceDay(page)
    expect(await horses(page)).toEqual(deepLinked)
  })
})

test.describe('persistence', () => {
  test.beforeEach(({ page }) => skipTour(page))

  test('settings survive a reload, the seed never does', async ({ page }) => {
    await visit(page, '/')
    const dialog = await openSetup(page)
    await stepper(dialog, 'horses').set(5)
    await stepper(dialog, 'rounds').set(3)
    await dialog.getByRole('switch', { name: 'Countdown' }).uncheck()
    await dialog.getByRole('radio', { name: '2×' }).check()
    await dialog.getByRole('textbox', { name: 'Seed' }).fill('777')
    await createRaceDay(page)
    const seeded = await horses(page)

    await reload(page)
    await expect(ui(page).summary).toHaveAccessibleName(/^5 horses\s*3 rounds\s*5 per round/)
    await expect(ui(page).speed(2)).toHaveAttribute('aria-pressed', 'true')
    expect(await horses(page)).not.toEqual(seeded) // no seed saved: a fresh stable

    await openSetup(page)
    await expect(stepper(dialog, 'horses').value).toHaveText('5')
    await expect(stepper(dialog, 'horses per round').value).toHaveText('5')
    await expect(stepper(dialog, 'rounds').value).toHaveText('3')
    await expect(dialog.getByRole('switch', { name: 'Countdown' })).not.toBeChecked()
    await expect(dialog.getByRole('radio', { name: '2×' })).toBeChecked()
    await expect(dialog.getByRole('textbox', { name: 'Seed' })).toHaveValue('')
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('1nsider:settings')!))
    expect(saved).toMatchObject({
      horseCount: 5,
      horsesPerRound: 5,
      countdown: false,
      speed: 2,
      seed: null,
    })
  })

  test('an empty seed draws a new stable on every load; a typed seed rebuilds the same one', async ({
    page,
  }) => {
    await visit(page, '/')
    let dialog = await openSetup(page)
    await expect(dialog.getByRole('textbox', { name: 'Seed' })).toHaveValue('')
    await createRaceDay(page)
    const stables = [await horses(page)]
    for (let i = 0; i < 2; i++) {
      await reload(page)
      stables.push(await horses(page))
    }
    expect(stables[1]).not.toEqual(stables[0])
    expect(stables[2]).not.toEqual(stables[1])

    dialog = await openSetup(page)
    await dialog.getByRole('textbox', { name: 'Seed' }).fill('4242')
    await createRaceDay(page)
    const seeded = await horses(page)
    await reload(page)
    await openSetup(page)
    await dialog.getByRole('textbox', { name: 'Seed' }).fill('4242')
    await createRaceDay(page)
    expect(await horses(page)).toEqual(seeded)
  })

  test('appearance applies instantly, without Create, and survives a reload', async ({ page }) => {
    await visit(page, '/')
    const dialog = await openSetup(page)
    await expect(dialog.getByRole('radio', { name: 'System' })).toBeChecked()

    await dialog.getByRole('radio', { name: 'Dark' }).check()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await pageBackground(page)).toBe(DARK)
    await dialog.getByRole('button', { name: 'Close' }).click()

    await reload(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await pageBackground(page)).toBe(DARK)
    await openSetup(page)
    await expect(dialog.getByRole('radio', { name: 'Dark' })).toBeChecked()

    await dialog.getByRole('radio', { name: 'Light' }).check()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    expect(await pageBackground(page)).toBe(LIGHT)

    // System follows the device.
    await dialog.getByRole('radio', { name: 'System' }).check()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/)
    await page.emulateMedia({ colorScheme: 'dark' })
    expect(await pageBackground(page)).toBe(DARK)
    await page.emulateMedia({ colorScheme: 'light' })
    expect(await pageBackground(page)).toBe(LIGHT)
    expect(await page.evaluate(() => localStorage.getItem('1nsider:theme'))).toBe('system')
  })

  test('a saved dark theme is on <html> before the app boots, so the page never flashes white', async ({
    page,
  }) => {
    await seedStorage(page, { '1nsider:theme': 'dark' })
    // Hold the app bundle back: whatever paints now is the bare HTML.
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route(/\/assets\/.*\.js$/, async (route) => {
      await held
      await route.continue()
    })
    await page.goto('/', { waitUntil: 'commit' })
    await expect(page.locator('#splash')).toBeVisible()
    expect(await page.evaluate(() => document.getElementById('app')!.childElementCount)).toBe(0)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(
      await page.locator('#splash').evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(DARK)

    release()
    await page.locator('#splash').waitFor({ state: 'detached' })
    expect(await pageBackground(page)).toBe(DARK)
  })
})
