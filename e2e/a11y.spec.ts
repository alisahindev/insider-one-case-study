import { expect, test } from '@playwright/test'
import {
  axeViolations,
  finishRaceDay,
  openRaceDay,
  seedStorage,
  settle,
  tick,
  ui,
  visit,
} from './fixtures'

// WCAG 2 A and AA, in every state a user can reach, in both themes.
// axe runs its own timers, so the fake clock is resumed right before each scan.
for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await seedStorage(page, { '1nsider:theme': theme })
    })

    test('idle race day has no WCAG A/AA violations', async ({ page }) => {
      await openRaceDay(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await page.clock.resume()
      expect(await axeViolations(page)).toEqual([])
    })

    test('mid-race has no WCAG A/AA violations', async ({ page }) => {
      await openRaceDay(page)
      await ui(page).generate.click()
      await ui(page).start.click()
      await tick(page, 5_000)
      await expect(ui(page).liveClock).toBeVisible()
      await page.clock.resume() // the round runs on at 1×, well past the scan
      expect(await axeViolations(page)).toEqual([])
    })

    test('finished race day, full results open, has no WCAG A/AA violations', async ({ page }) => {
      test.slow()
      await openRaceDay(page)
      await finishRaceDay(page)
      await ui(page).results.getByText('All 10 finishers').first().click()
      await ui(page).program.locator('summary').first().click()
      await settle(page)
      await page.clock.resume()
      expect(await axeViolations(page)).toEqual([])
    })

    test('setup dialog, seed tip open, has no WCAG A/AA violations', async ({ page }) => {
      await openRaceDay(page)
      await ui(page).summary.click()
      await ui(page).setup.getByRole('button', { name: 'What is a seed?' }).click()
      await expect(ui(page).setup.locator('#seed-help')).toBeVisible()
      await page.clock.resume()
      expect(await axeViolations(page)).toEqual([])
    })

    test('onboarding tour has no WCAG A/AA violations', async ({ page }) => {
      await visit(page, '/') // first visit: the tour opens by itself
      await expect(ui(page).tour).toBeVisible()
      expect(await axeViolations(page)).toEqual([])
      await ui(page).tour.getByRole('button', { name: 'Show me around' }).click()
      await expect(ui(page).tour.getByText('2 of 9', { exact: true })).toBeVisible()
      expect(await axeViolations(page)).toEqual([])
    })
  })
}
