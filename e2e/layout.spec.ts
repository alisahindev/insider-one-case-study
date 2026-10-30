import { expect, test, type Locator, type Page } from '@playwright/test'
import { reload, seedStorage, ui, visit } from './fixtures'

const DEFAULT = { left: ['Stable'], right: ['Program', 'Results'] }

/** Panel titles per side column, top to bottom. */
const columns = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      ['left', 'right'].map((side) => [
        side,
        [...document.querySelectorAll(`.column--${side} .panel__title`)].map((h) =>
          h.textContent!.trim(),
        ),
      ]),
    ),
  )

const handle = (page: Page, panel: string) =>
  page.getByRole('button', { name: `Move ${panel} panel` })
const resetLayout = (page: Page) =>
  page.getByRole('contentinfo').getByRole('button', { name: 'Reset layout' })
const announcement = (page: Page) =>
  page.locator('p[aria-live="polite"]').filter({ hasText: /panel|Panels/ })

/**
 * A real drag: press on the handle, travel in small steps, release over the lower part of the target.
 * Phones get touch events (SortableJS listens for touch there), desktops a mouse.
 */
async function drag(page: Page, from: Locator, to: Locator, touch: boolean) {
  await from.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  const path = Array.from({ length: 31 }, (_, i) => {
    const t = i / 30
    return {
      x: a.x + a.width / 2 + (b.x + b.width / 2 - a.x - a.width / 2) * t,
      y: a.y + a.height / 2 + (b.y + b.height * 0.75 - a.y - a.height / 2) * t,
    }
  })
  if (touch) {
    const cdp = await page.context().newCDPSession(page)
    const touchEvent = (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      point?: { x: number; y: number },
    ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [point] : [] })
    await touchEvent('touchStart', path[0])
    for (const point of path.slice(1)) await touchEvent('touchMove', point)
    await touchEvent('touchEnd')
    return
  }
  await page.mouse.move(path[0]!.x, path[0]!.y)
  await page.mouse.down()
  for (const point of path.slice(1)) await page.mouse.move(point.x, point.y)
  await page.mouse.up()
}

test.beforeEach(({ page }) => visit(page))

test('panels start in their default columns with no Reset layout button', async ({ page }) => {
  expect(await columns(page)).toEqual(DEFAULT)
  await expect(resetLayout(page)).toBeHidden()
  for (const panel of ['Stable', 'Program', 'Results']) {
    await expect(handle(page, panel)).toHaveAccessibleDescription(/use the arrow keys/)
  }
})

test('drag a panel by its handle into the other column; it stays there after a reload', async ({
  page,
  isMobile,
}) => {
  await drag(page, handle(page, 'Stable'), ui(page).results, isMobile)
  await expect
    .poll(() => columns(page))
    .toEqual({ left: [], right: ['Program', 'Results', 'Stable'] })
  await expect(page.locator('.column--left')).toHaveAttribute(
    'data-empty-label',
    'Drop a panel here',
  )
  await expect(resetLayout(page)).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('1nsider:layout')!))).toEqual({
    left: [],
    right: ['program', 'results', 'stable'],
  })

  await reload(page)
  expect(await columns(page)).toEqual({ left: [], right: ['Program', 'Results', 'Stable'] })
})

test('drag a panel into an empty column', async ({ page, isMobile }) => {
  // Phones stack the columns, so the empty one sits a whole stable below; keyboard moves cover it there.
  test.skip(isMobile, 'columns stack on phones')
  await handle(page, 'Stable').focus()
  await page.keyboard.press('ArrowRight') // empties the left column
  await expect
    .poll(() => columns(page))
    .toEqual({ left: [], right: ['Stable', 'Program', 'Results'] })

  await drag(page, handle(page, 'Results'), page.locator('.column--left'), false)
  await expect
    .poll(() => columns(page))
    .toEqual({ left: ['Results'], right: ['Stable', 'Program'] })
})

test('arrow keys on a handle move the panel and announce where it went', async ({ page }) => {
  const stable = handle(page, 'Stable')
  await stable.focus()

  await page.keyboard.press('ArrowRight')
  await expect
    .poll(() => columns(page))
    .toEqual({ left: [], right: ['Stable', 'Program', 'Results'] })
  await expect(announcement(page)).toHaveText(
    'Stable panel moved to the right column, position 1 of 3.',
  )
  await expect(handle(page, 'Stable')).toBeFocused() // focus follows the panel

  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect
    .poll(() => columns(page))
    .toEqual({ left: [], right: ['Program', 'Results', 'Stable'] })
  await expect(announcement(page)).toHaveText(
    'Stable panel moved to the right column, position 3 of 3.',
  )
  await page.keyboard.press('ArrowDown') // already last: nothing happens
  await expect
    .poll(() => columns(page))
    .toEqual({ left: [], right: ['Program', 'Results', 'Stable'] })

  await page.keyboard.press('ArrowLeft')
  await expect
    .poll(() => columns(page))
    .toEqual({ left: ['Stable'], right: ['Program', 'Results'] })
  await expect(announcement(page)).toHaveText(
    'Stable panel moved to the left column, position 1 of 1.',
  )
  // The app refocuses a moved handle one frame later; wait for it, or it can steal the next focus.
  await expect(handle(page, 'Stable')).toBeFocused()

  await handle(page, 'Results').focus()
  await page.keyboard.press('ArrowLeft')
  await expect(handle(page, 'Results')).toBeFocused() // refocused a frame after it re-mounts
  await page.keyboard.press('ArrowUp')
  await expect
    .poll(() => columns(page))
    .toEqual({ left: ['Results', 'Stable'], right: ['Program'] })
  await expect(announcement(page)).toHaveText(
    'Results panel moved to the left column, position 1 of 2.',
  )
})

test('Reset layout puts every panel back and then hides itself', async ({ page }) => {
  await handle(page, 'Program').focus()
  await page.keyboard.press('ArrowLeft')
  await expect(resetLayout(page)).toBeVisible()

  await resetLayout(page).click()
  await expect.poll(() => columns(page)).toEqual(DEFAULT)
  await expect(announcement(page)).toHaveText('Panels are back in their default places.')
  await expect(resetLayout(page)).toBeHidden()
  await reload(page)
  expect(await columns(page)).toEqual(DEFAULT)
})

test('a damaged saved layout falls back to the default one', async ({ page }) => {
  for (const saved of [
    { left: ['stable', 'stable'], right: ['program'] }, // a panel twice, one missing
    { left: ['stable'], right: ['program', 'charts'] }, // an unknown panel
    'not json',
  ]) {
    await seedStorage(page, {
      '1nsider:layout': typeof saved === 'string' ? saved : JSON.stringify(saved),
    })
    await reload(page)
    expect(await columns(page)).toEqual(DEFAULT)
    await expect(resetLayout(page)).toBeHidden()
  }
})
