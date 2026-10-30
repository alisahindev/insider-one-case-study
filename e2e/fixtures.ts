import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page } from '@playwright/test'

export const SEED = 48213
export const RACE_DAY = `/?seed=${SEED}`
export const DISTANCES = [1200, 1400, 1600, 1800, 2000, 2200]
const T0 = new Date('2026-01-01T12:00:00Z').getTime()

/** Waits for the boot splash to fade out and leave the DOM; it covers the app until then. */
export const appReady = (page: Page) => page.locator('#splash').waitFor({ state: 'detached' })

/** Reloads and waits for the splash again; until it is gone it swallows every click. */
export async function reload(page: Page) {
  await page.reload()
  await appReady(page)
}

/** Runs before every page load (reloads too), so storage is set before the app reads it. */
export const seedStorage = (page: Page, entries: Record<string, string>) =>
  page.addInitScript((e) => {
    for (const [key, value] of Object.entries(e)) localStorage.setItem(key, value)
  }, entries)

/** A returning visitor: the onboarding tour has been seen. */
export const skipTour = (page: Page) => seedStorage(page, { '1nsider:tour-seen': '1' })

/** Opens the app on real time. For flows that reload or never run a race. */
export async function visit(page: Page, path = RACE_DAY) {
  await page.goto(path)
  await appReady(page)
}

/**
 * Opens the app on a fake clock and pauses it at a fixed instant once the splash is gone.
 * From then on only `tick()` moves the race loop, countdown and Vue transitions, so every
 * test (and every screenshot) sees exactly the same frames.
 */
export async function openRaceDay(page: Page, path = RACE_DAY) {
  await page.clock.install({ time: T0 })
  await page.goto(path)
  await appReady(page)
  await page.clock.pauseAt(T0 + 60_000)
}

/** Advances the paused fake clock: requestAnimationFrame fires every 16 ms of it. */
export const tick = (page: Page, ms: number) => page.clock.runFor(ms)

/** Lets enter/leave transitions (they wait on frames and timers) finish on the paused clock. */
export const settle = (page: Page) => tick(page, 500)

export function ui(page: Page) {
  const header = page.getByRole('banner')
  return {
    header,
    summary: header.getByRole('button', { name: /change race day settings/ }),
    generate: header.getByRole('button', { name: 'Generate program' }),
    start: header.getByRole('button', { name: /^(Start|Pause|Resume|Race again)$/ }),
    speed: (x: 1 | 2 | 4) => header.getByRole('button', { name: `${x}×`, exact: true }),
    takeTour: header.getByRole('button', { name: 'Take the tour' }),
    race: page.getByRole('region', { name: 'Race' }),
    stable: page.getByRole('region', { name: 'Stable' }),
    program: page.getByRole('region', { name: 'Program' }),
    results: page.getByRole('region', { name: 'Results' }),
    setup: page.getByRole('dialog', { name: 'New race day' }),
    tour: page.locator('dialog.tour'),
    countdown: page.locator('.countdown'),
    /** "10 runners · 0:12" ("1 runner · …"), shown while a round is live. */
    liveClock: page.getByText(/^\d+ runners? · \d+:\d\d$/),
  }
}

/** Race clock seconds from the live subtitle ("10 runners · 1:05" → 65). */
export async function raceSeconds(page: Page) {
  const text = (await ui(page).liveClock.textContent()) ?? ''
  const [, m, s] = /(\d+):(\d\d)$/.exec(text) ?? []
  return Number(m) * 60 + Number(s)
}

export interface HorseRow {
  name: string
  color: string
  condition: number
}

/** The Stable table as data, in display order. */
export const horses = (page: Page): Promise<HorseRow[]> =>
  ui(page)
    .stable.getByRole('row')
    .filter({ has: page.getByRole('meter') })
    .evaluateAll((rows) =>
      rows.map((row) => ({
        name: row.querySelector('.name')!.textContent!.trim(),
        color: row.querySelector('.meta')!.textContent!.split('·')[1]!.trim(),
        condition: (row.querySelector('meter') as HTMLMeterElement).value,
      })),
    )

/** Each round of the program as "Round N · Dm" plus its entrants' names, in gate order. */
export const program = (page: Page) =>
  ui(page)
    .program.locator('details')
    .evaluateAll((rounds) =>
      rounds.map((round) => ({
        title: round.querySelector('.round-title')!.textContent!.trim(),
        entrants: [...round.querySelectorAll('.entrants li')].map((li) =>
          li.textContent!.replace(/^\s*\d+/, '').trim(),
        ),
      })),
    )

/** Result headings in the Results panel, newest first ("Round 2 · 1400m", "Round 1 · 1200m"). */
export const resultTitles = (page: Page) => ui(page).results.getByRole('heading', { level: 3 })

/** Finishing order of one round's result card, every finisher, winner first. */
export const finishingOrder = (page: Page, round: number) =>
  ui(page)
    .results.getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: new RegExp(`^Round ${round} ·`) }) })
    .locator('.finishers li span')
    .allTextContents()

/** Horizontal offset of every runner on the track, read from its CSS transform. */
export const runnerOffsets = (page: Page) =>
  page
    .locator('.runner')
    .evaluateAll((els) =>
      els.map((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41),
    )

/** Ticks a second at a time until `count` rounds have results (or the day is over). */
export async function raceUntilResults(page: Page, count: number) {
  const titles = resultTitles(page)
  for (let i = 0; i < 600 && (await titles.count()) < count; i++) await tick(page, 1_000)
  await settle(page)
  await expect(titles).toHaveCount(count)
}

/** Runs the rest of the race day at 4× (drawing a program first if needed) until it is over. */
export async function finishRaceDay(page: Page, rounds = DISTANCES.length) {
  const { speed, start } = ui(page)
  await speed(4).click()
  if (/^(Start|Resume)$/.test((await start.textContent())!.trim())) await start.click()
  await raceUntilResults(page, rounds)
  await expect(page.getByRole('heading', { name: 'Race day complete' })).toBeVisible()
}

/** A NumberStepper inside the setup dialog, found by its group label ("horses", "rounds"…). */
export function stepper(dialog: Locator, label: string) {
  const group = dialog.getByRole('group', { name: label, exact: true })
  return {
    value: group.locator('output'),
    decrease: group.getByRole('button', { name: `Decrease ${label}`, exact: true }),
    increase: group.getByRole('button', { name: `Increase ${label}`, exact: true }),
    /** Clicks − or + until the stepper shows `target`. */
    async set(target: number) {
      for (let i = 0; i < 40; i++) {
        const current = parseInt((await group.locator('output').textContent()) ?? '', 10)
        if (current === target) return
        await (current > target ? this.decrease : this.increase).click()
      }
      throw new Error(`stepper "${label}" never reached ${target}`)
    },
  }
}

/** WCAG 2 A/AA scan; returns violations as "rule: selectors" lines, so failures read well. */
export async function axeViolations(page: Page) {
  // Let entrance animations end first: mid-fade text reads as low contrast. Loops never end, so skip them.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  )
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}
