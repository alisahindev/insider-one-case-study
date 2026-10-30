import { expect, test, type Page } from '@playwright/test'
import { finishRaceDay, openRaceDay, seedStorage, settle, tick, ui } from './fixtures'

// A fixed seed and a paused fake clock make every frame reproducible, so whole screens
// compare pixel by pixel. CSS animations are frozen by the toHaveScreenshot config.
// The mouse rests on the last clicked button; park it so hover styles stay out of the picture.
const parkMouse = (page: Page) => page.mouse.move(0, 0)

async function midRace(page: Page) {
  await ui(page).generate.click()
  await settle(page)
  await ui(page).start.click()
  await tick(page, 6_000) // 3 s countdown, then 3 s (18 race seconds) of running
}

test.describe('visual', () => {
  test('idle race day', async ({ page }) => {
    await openRaceDay(page)
    await parkMouse(page)
    await expect(page).toHaveScreenshot('idle.png', { fullPage: true })
  })

  test('program ready at the gate', async ({ page }) => {
    await openRaceDay(page)
    await ui(page).generate.click()
    await settle(page)
    await parkMouse(page)
    await expect(page).toHaveScreenshot('ready.png', { fullPage: true })
  })

  test('mid race', async ({ page }) => {
    await openRaceDay(page)
    await midRace(page)
    await parkMouse(page)
    await expect(page).toHaveScreenshot('mid-race.png', { fullPage: true })
  })

  test('race day complete', async ({ page }) => {
    test.slow()
    await openRaceDay(page)
    await finishRaceDay(page)
    await parkMouse(page)
    await expect(page).toHaveScreenshot('finished.png', { fullPage: true })
  })

  test('setup dialog', async ({ page }) => {
    await openRaceDay(page)
    await ui(page).summary.click()
    await expect(ui(page).setup).toBeVisible()
    await parkMouse(page)
    await expect(page).toHaveScreenshot('setup-dialog.png')
  })

  test('tour spotlighting the setup pill', async ({ page }) => {
    await openRaceDay(page)
    await ui(page).takeTour.click()
    await ui(page).tour.getByRole('button', { name: 'Show me around' }).click()
    await tick(page, 1_000) // the spotlight glides and the text swaps on frames of the paused clock
    await expect(ui(page).tour.getByRole('heading', { name: 'Set up your race day' })).toBeVisible()
    await parkMouse(page)
    await expect(page).toHaveScreenshot('tour-step-2.png')
  })

  test('dark mode mid race', async ({ page }) => {
    await seedStorage(page, { '1nsider:theme': 'dark' })
    await openRaceDay(page)
    await midRace(page)
    await parkMouse(page)
    await expect(page).toHaveScreenshot('dark-mid-race.png', { fullPage: true })
  })
})
