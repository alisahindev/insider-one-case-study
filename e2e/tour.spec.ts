import { expect, test, type Locator, type Page } from '@playwright/test'
import { RACE_DAY, reload, skipTour, ui, visit } from './fixtures'

const STEPS = [
  'Welcome to 1nsider',
  'Set up your race day',
  'Draw and run',
  'On the track',
  'Live standings',
  'The stable',
  'Make the layout yours',
  'Results',
  'You’re ready',
]

const seen = (page: Page) => page.evaluate(() => localStorage.getItem('1nsider:tour-seen'))

function tour(page: Page) {
  const dialog = ui(page).tour
  return {
    dialog,
    title: dialog.getByRole('heading', { level: 2 }),
    count: dialog.getByText(/^\d+ of 9$/),
    skip: dialog.getByRole('button', { name: 'Skip tour' }),
    back: dialog.getByRole('button', { name: 'Back' }),
    next: dialog.getByRole('button', { name: /^(Show me around|Next|Start racing)$/ }),
  }
}

async function expectStep(page: Page, n: number) {
  const t = tour(page)
  await expect(t.title).toHaveText(STEPS[n - 1]!)
  await expect(t.count).toHaveText(`${n} of 9`)
}

test.describe('first visit', () => {
  test.beforeEach(({ page }) => visit(page, '/'))

  test('opens the tour right after the splash, focused on its first step', async ({ page }) => {
    const t = tour(page)
    await expect(t.dialog).toBeVisible()
    await expectStep(page, 1)
    await expect(t.next).toHaveText('Show me around')
    await expect(t.next).toBeFocused()
    await expect(t.skip).toBeVisible()
    await expect(t.back).toBeHidden()
    expect(await seen(page)).toBeNull() // not marked seen until it is closed
  })

  test('walks all 9 steps and finishes with Start racing; it is not shown again', async ({
    page,
  }) => {
    const t = tour(page)
    for (let n = 1; n < 9; n++) {
      await expectStep(page, n)
      await expect(t.next).toHaveText(n === 1 ? 'Show me around' : 'Next')
      await t.next.click()
    }
    await expectStep(page, 9)
    await expect(t.skip).toBeHidden()
    await expect(t.next).toHaveText('Start racing')
    await t.next.click()
    await expect(t.dialog).toBeHidden()
    expect(await seen(page)).toBe('1')

    await reload(page)
    await expect(t.dialog).toBeHidden()
  })

  test('Back and the arrow keys move between steps', async ({ page }) => {
    const t = tour(page)
    await t.next.click()
    await expectStep(page, 2)
    await t.back.click()
    await expectStep(page, 1)
    await expect(t.back).toBeHidden()
    await expect(t.next).toBeFocused() // the Back button vanished; focus stays in the card

    await page.keyboard.press('ArrowRight')
    await expectStep(page, 2)
    await page.keyboard.press('ArrowRight')
    await expectStep(page, 3)
    await page.keyboard.press('ArrowLeft')
    await expectStep(page, 2)
  })

  test('the spotlight follows each step to its part of the page', async ({ page }) => {
    const t = tour(page)
    const hole = t.dialog.locator('.hole')
    const covers = async (target: Locator) => {
      const [h, r] = [(await hole.boundingBox())!, (await target.boundingBox())!]
      return (
        h.x <= r.x &&
        h.y <= r.y &&
        h.x + h.width >= r.x + r.width &&
        h.y + h.height >= r.y + r.height
      )
    }
    await t.next.click()
    await expect.poll(() => covers(ui(page).summary)).toBe(true)
    for (let n = 2; n < 6; n++) await t.next.click()
    await expectStep(page, 6)
    await expect.poll(() => covers(ui(page).stable)).toBe(true)
  })

  test('Skip tour closes it for good', async ({ page }) => {
    await tour(page).skip.click()
    await expect(tour(page).dialog).toBeHidden()
    expect(await seen(page)).toBe('1')
    await reload(page)
    await expect(tour(page).dialog).toBeHidden()
  })

  test('Esc closes it and counts as seen', async ({ page }) => {
    await tour(page).next.click()
    await page.keyboard.press('Escape')
    await expect(tour(page).dialog).toBeHidden()
    expect(await seen(page)).toBe('1')
  })
})

test('is not shown on a deep link, even to a first-time visitor', async ({ page }) => {
  await visit(page, RACE_DAY)
  await expect(ui(page).stable).toBeVisible()
  await expect(tour(page).dialog).toBeHidden()
  expect(await seen(page)).toBeNull()
})

test('is not shown on a second visit; Take the tour replays it from the start', async ({
  page,
}) => {
  await skipTour(page)
  await visit(page, '/')
  await expect(tour(page).dialog).toBeHidden()

  await ui(page).takeTour.click()
  await expect(tour(page).dialog).toBeVisible()
  await expectStep(page, 1)
  await tour(page).next.click()
  await tour(page).skip.click()
  await expect(tour(page).dialog).toBeHidden()

  await ui(page).takeTour.click() // replays from step 1, not where it was left
  await expectStep(page, 1)
})

test('opening the tour pauses a running race', async ({ page }) => {
  await visit(page, RACE_DAY)
  await ui(page).start.click()
  await expect(ui(page).start).toHaveText('Pause')

  await ui(page).takeTour.click()
  await expect(tour(page).dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tour(page).dialog).toBeHidden()
  await expect(ui(page).start).toHaveText('Resume')
  await expect(ui(page).race.getByText('Paused', { exact: true })).toBeVisible()
})
