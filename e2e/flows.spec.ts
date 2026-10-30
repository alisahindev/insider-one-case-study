import { expect, test, type Page } from '@playwright/test'
import {
  finishRaceDay,
  horses,
  openRaceDay,
  program,
  raceSeconds,
  resultTitles,
  runnerOffsets,
  settle,
  tick,
  ui,
} from './fixtures'

test.beforeEach(({ page }) => openRaceDay(page))

const notice = (page: Page, title: string) =>
  ui(page)
    .race.locator('.notice')
    .filter({ has: page.getByRole('heading', { name: title }) })

test.describe('race flow', () => {
  test('the track says what to do next: idle, ready, racing, finished', async ({ page }) => {
    test.slow()
    const { race, start, setup } = ui(page)
    const idle = notice(page, 'Set the field')
    await expect(idle).toContainText('Draw 10 of your 20 horses for each of the 6 rounds.')
    await expect(start).toHaveText('Start')
    await expect(race.getByRole('heading', { level: 2 })).toHaveText('Race day')

    await idle.getByRole('button', { name: 'Race settings' }).click()
    await expect(setup).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(setup).toBeHidden()

    await idle.getByRole('button', { name: 'Generate program' }).click()
    await settle(page)
    const ready = notice(page, 'Round 1 is at the gate')
    await expect(ready).toContainText('6 rounds from 1200m to 2200m, run back to back.')
    await expect(ready.getByRole('button', { name: 'Race settings' })).toBeVisible()
    await expect(race.getByRole('heading', { level: 2 })).toHaveText('Round 1 · 1200m')

    await ready.getByRole('button', { name: 'Start the races' }).click()
    await expect(start).toHaveText('Pause')
    await tick(page, 4_000)
    await expect(ui(page).liveClock).toHaveText(/^10 runners · 0:0\d$/)
    await expect(race.getByText(/^\d+m to go$/)).toBeVisible()

    await finishRaceDay(page)
    await expect(
      notice(page, 'Race day complete').getByRole('button', { name: 'Race again' }),
    ).toBeVisible()
    await expect(start).toHaveText('Race again')
    await expect(ui(page).liveClock).toBeHidden()
  })

  test('Start on an empty day draws a program first, then races', async ({ page }) => {
    const { start, program: panel } = ui(page)
    await expect(panel.locator('details')).toHaveCount(0)
    await start.click()
    await expect(panel.locator('details')).toHaveCount(6)
    await expect(start).toHaveText('Pause')
    await expect(panel.locator('summary').first()).toContainText('Live')
  })

  test('every round opens with a 3, 2, 1 countdown while the horses wait at the gate', async ({
    page,
  }) => {
    const { generate, start, countdown } = ui(page)
    await generate.click()
    await start.click()
    for (const n of ['3', '2', '1']) {
      await tick(page, n === '3' ? 300 : 1_000)
      await expect(countdown).toHaveText(n)
      expect(await runnerOffsets(page)).toEqual(Array(10).fill(0))
    }
    await tick(page, 1_000)
    await expect(countdown).toBeHidden()
    expect(Math.min(...(await runnerOffsets(page)))).toBeGreaterThan(0)
  })

  test('pause freezes the round mid-race and resume carries on from the same spot', async ({
    page,
  }) => {
    const { generate, start, race, program: panel } = ui(page)
    await generate.click()
    await start.click()
    await tick(page, 5_000)

    await start.click()
    await expect(start).toHaveText('Resume')
    await expect(race.getByText('Paused', { exact: true })).toBeVisible()
    await expect(panel.locator('summary').first()).toContainText('Live')
    const clock = await raceSeconds(page)
    const offsets = await runnerOffsets(page)

    await tick(page, 3_000)
    expect(await raceSeconds(page)).toBe(clock)
    expect(await runnerOffsets(page)).toEqual(offsets)
    await expect(page.locator('.runner .figure--hold')).toHaveCount(10) // legs freeze too

    await start.click()
    await expect(start).toHaveText('Pause')
    await expect(race.getByText('Paused', { exact: true })).toBeHidden()
    await tick(page, 1_000)
    expect(await raceSeconds(page)).toBeGreaterThan(clock)
    ;(await runnerOffsets(page)).forEach((x, i) => expect(x).toBeGreaterThan(offsets[i]!))
    await expect(resultTitles(page)).toHaveCount(0) // still round 1, nothing skipped
  })

  test('changing speed mid-race changes how fast race time runs', async ({ page }) => {
    const { generate, start, speed } = ui(page)
    await generate.click()
    await start.click()
    await tick(page, 3_000) // countdown

    // Race time runs 6× wall time at 1×, so one second of clock is ~6, ~24 and ~12 race seconds.
    for (const [x, expected] of [
      [1, 6],
      [4, 24],
      [2, 12],
    ] as const) {
      await speed(x).click()
      await expect(speed(x)).toHaveAttribute('aria-pressed', 'true')
      for (const other of ([1, 2, 4] as const).filter((o) => o !== x)) {
        await expect(speed(other)).toHaveAttribute('aria-pressed', 'false')
      }
      const before = await raceSeconds(page)
      await tick(page, 1_000)
      expect(Math.abs((await raceSeconds(page)) - before - expected)).toBeLessThanOrEqual(1)
    }
    await expect(resultTitles(page)).toHaveCount(0)
  })

  test('Race again after the last round clears the results and races a new program', async ({
    page,
  }) => {
    test.slow()
    await finishRaceDay(page)
    const first = await program(page)
    await expect(ui(page).program.locator('summary', { hasText: 'Finished' })).toHaveCount(6)

    await ui(page).start.click() // "Race again"
    await settle(page)
    await expect(ui(page).start).toHaveText('Pause')
    await expect(resultTitles(page)).toHaveCount(0)
    await expect(ui(page).results).toContainText('0 of 6')
    await expect(ui(page).program.locator('summary').first()).toContainText('Live')
    expect(await program(page)).not.toEqual(first) // a fresh draw from the same stable
    await expect(ui(page).countdown).toHaveText(/[123]/)
  })

  test('Generate while a program is ready draws a different one and stays ready', async ({
    page,
  }) => {
    const { generate, start } = ui(page)
    await generate.click()
    const first = await program(page)
    await generate.click()
    await settle(page)
    const second = await program(page)
    expect(second.map((r) => r.title)).toEqual(first.map((r) => r.title))
    expect(second).not.toEqual(first)
    await expect(start).toHaveText('Start')
    await expect(notice(page, 'Round 1 is at the gate')).toBeVisible()
  })

  test('Generate mid-race stops the race and puts a fresh program at the gate', async ({
    page,
  }) => {
    const { generate, start, speed } = ui(page)
    await generate.click()
    await speed(4).click()
    await start.click()
    for (let i = 0; i < 30 && (await resultTitles(page).count()) < 1; i++) await tick(page, 1_000)
    const before = await program(page)

    await generate.click()
    await settle(page)
    await expect(start).toHaveText('Start')
    await expect(resultTitles(page)).toHaveCount(0)
    await expect(notice(page, 'Round 1 is at the gate')).toBeVisible()
    expect(await program(page)).not.toEqual(before)
  })

  test("the stable lists the current round's runners first and dims the rest", async ({ page }) => {
    const { generate, stable } = ui(page)
    await expect(stable.locator('tr.resting')).toHaveCount(0)
    await generate.click()
    const [round1] = await program(page)

    const order = (await horses(page)).map((h) => h.name)
    expect(new Set(order.slice(0, 10))).toEqual(new Set(round1!.entrants))
    await expect(stable.locator('tbody tr').nth(9)).not.toHaveClass(/resting/)
    await expect(stable.locator('tr.resting')).toHaveCount(10)
    for (const row of await stable.locator('tr.resting').all()) {
      expect(round1!.entrants).not.toContain(await row.locator('.name').textContent())
    }
  })
})

test.describe('keyboard shortcuts', () => {
  test('G draws, Space starts, pauses and resumes, 1/2/4 set the speed', async ({ page }) => {
    const { start, speed, program: panel } = ui(page)
    await page.keyboard.press('g')
    await expect(panel.locator('details')).toHaveCount(6)
    const first = await program(page)
    await page.keyboard.press('G')
    expect(await program(page)).not.toEqual(first)

    await page.keyboard.press('Space')
    await expect(start).toHaveText('Pause')
    await page.keyboard.press('Space')
    await expect(start).toHaveText('Resume')
    await page.keyboard.press('Space')
    await expect(start).toHaveText('Pause')

    for (const x of [4, 2, 1] as const) {
      await page.keyboard.press(String(x))
      await expect(speed(x)).toHaveAttribute('aria-pressed', 'true')
    }
  })

  test('Space on a focused button presses that button only', async ({ page }) => {
    const { generate, start } = ui(page)
    await generate.focus()
    await page.keyboard.press('Space')
    await expect(ui(page).program.locator('details')).toHaveCount(6)
    await expect(start).toHaveText('Start') // the shortcut did not also start the race

    await start.focus()
    await page.keyboard.press('Space')
    await expect(start).toHaveText('Pause') // toggled once, not started and paused again
  })

  test('shortcuts do nothing while the setup dialog is open or a field has focus', async ({
    page,
  }) => {
    const { summary, setup, speed, start, program: panel } = ui(page)
    await summary.click()
    await expect(setup).toBeVisible()
    for (const key of ['g', '4']) await page.keyboard.press(key)

    const seed = setup.getByRole('textbox', { name: 'Seed' })
    await seed.click()
    await page.keyboard.type('2g4')
    await expect(seed).toHaveValue('2g4')

    await page.keyboard.press('Escape')
    await expect(setup).toBeHidden()
    await expect(panel.locator('details')).toHaveCount(0)
    await expect(speed(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(start).toHaveText('Start')
  })

  test('shortcuts do nothing while the tour is open', async ({ page }) => {
    const { takeTour, tour, program: panel, speed } = ui(page)
    await takeTour.click()
    await expect(tour).toBeVisible()
    for (const key of ['g', '4']) await page.keyboard.press(key)
    await expect(panel.locator('details')).toHaveCount(0)
    await expect(speed(1)).toHaveAttribute('aria-pressed', 'true')
  })
})
