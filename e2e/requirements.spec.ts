import { expect, test, type Page } from '@playwright/test'
import {
  DISTANCES,
  SEED,
  horses,
  openRaceDay,
  program,
  raceUntilResults,
  resultTitles,
  runnerOffsets,
  settle,
  tick,
  ui,
  visit,
} from './fixtures'

// One test per requirement and rule of the assessment PDF, in the PDF's own order.
// Requirements 1 (Vue) and 7 (coding style) are about the code, not behaviour, so have no E2E test.
test.beforeEach(({ page }) => openRaceDay(page))

const roundTitles = DISTANCES.map((d, i) => `Round ${i + 1} · ${d}m`)
const trackNames = (page: Page) =>
  page
    .locator('.runner .tag')
    .evaluateAll((tags) => tags.map((t) => t.textContent!.replace(/^\d+\.\s*/, '').trim()))

test.describe('Requirements', () => {
  test('2. Generate Horse List: 1 to 20 horses, randomly generated', async ({ page }) => {
    const stable = await horses(page)
    expect(stable).toHaveLength(20)

    // A different seed is a different random stable.
    await visit(page, `/?seed=${SEED + 1}`)
    expect(await horses(page)).not.toEqual(stable)

    // The list size stays within 1–20, whatever is asked for.
    for (const [asked, shown] of [
      [1, 1],
      [7, 7],
      [0, 1],
      [99, 20],
    ]) {
      await visit(page, `/?seed=${SEED}&horses=${asked}`)
      await expect(ui(page).stable.getByRole('meter')).toHaveCount(shown!)
    }
  })

  test('3. Generate Race Schedule: the Generate button creates a 6-round schedule', async ({
    page,
  }) => {
    const { program: panel, generate } = ui(page)
    await expect(panel).toContainText('Generate a program to draw 10 horses for each round.')
    await expect(panel.locator('details')).toHaveCount(0)

    await generate.click()
    await expect(panel.locator('details')).toHaveCount(6)
    expect((await program(page)).map((r) => r.title)).toEqual(roundTitles)
  })

  test('4. Start the Race: Start runs the rounds one at a time', async ({ page }) => {
    test.slow() // races the whole day
    const { generate, speed, start, program: panel, race } = ui(page)
    await generate.click()
    const schedule = await program(page)
    await speed(4).click()
    await start.click()
    await tick(page, 1_000) // countdown (3 s at 4×), then the race is on

    const summaries = panel.locator('summary')
    for (let n = 1; n <= 6; n++) {
      // Exactly one round is live; everything before it is finished and everything after waits.
      await expect(race.getByRole('heading', { level: 2 })).toHaveText(roundTitles[n - 1]!)
      await expect(summaries).toHaveText(
        roundTitles.map(
          (title, i) =>
            new RegExp(`${title}\\s*${i + 1 < n ? 'Finished' : i + 1 === n ? 'Live' : 'Up next'}`),
        ),
      )
      // Only this round's ten entrants are on the track, and earlier rounds alone have results.
      expect(await trackNames(page)).toEqual(schedule[n - 1]!.entrants)
      await expect(resultTitles(page)).toHaveCount(n - 1)
      await raceUntilResults(page, n)
      await tick(page, 1_000) // the next round's countdown
    }
    await expect(page.getByRole('heading', { name: 'Race day complete' })).toBeVisible()
  })

  test('5. Display Race Results: each result appears in Results, in turn, as its round ends', async ({
    page,
  }) => {
    test.slow()
    const { generate, speed, start, results } = ui(page)
    await generate.click()
    await speed(4).click()
    await start.click()
    await expect(results).toContainText('Results land here as each round finishes.')

    const finished = ui(page).program.locator('summary', { hasText: 'Finished' })
    let shown = 0
    for (let i = 0; i < 300 && shown < 6; i++) {
      await tick(page, 250)
      const count = await resultTitles(page).count()
      // A result never shows before its round is over, and never lags behind it.
      await expect(finished).toHaveCount(count)
      if (count === shown) continue
      // eslint-disable-next-line playwright/prefer-to-have-count -- count is the snapshot read above
      expect(count).toBe(shown + 1) // one at a time, in order
      shown = count
      await settle(page)
      await expect(resultTitles(page)).toHaveText(roundTitles.slice(0, shown).reverse()) // newest first
      await expect(results.getByRole('heading', { level: 2 })).toHaveText('Results')
      await expect(results).toContainText(`${shown} of 6`)
      await expect(results.locator('[aria-live]')).toContainText(`Round ${shown} finished.`)
    }
    expect(shown).toBe(6)

    // Every result card holds the whole field: podium plus "All 10 finishers".
    await expect(results.getByText('All 10 finishers')).toHaveCount(6)
  })

  test('6. Animated Horse Movement: horses visibly move during each race', async ({ page }) => {
    const { generate, start } = ui(page)
    await generate.click()
    await start.click()
    await tick(page, 3_000) // countdown: everyone at the gate
    const atGate = await runnerOffsets(page)
    expect(atGate).toEqual(Array(10).fill(0))

    let previous = atGate
    for (let step = 0; step < 3; step++) {
      await tick(page, 1_000)
      const now = await runnerOffsets(page)
      now.forEach((x, i) => expect(x, `runner ${i + 1} moved`).toBeGreaterThan(previous[i]! + 5))
      previous = now
    }
    await expect(page.locator('.runner .figure--gallop')).toHaveCount(10)
  })
})

test.describe('Rules and conditions', () => {
  test('1. the game has a total of 20 horses available for racing', async ({ page }) => {
    await expect(ui(page).stable.getByRole('meter')).toHaveCount(20)
    await expect(ui(page).stable).toContainText('20 horses')
    await expect(ui(page).summary).toContainText('20 horses')
  })

  test('2. each horse is represented with a unique colour', async ({ page }) => {
    const stable = await horses(page)
    expect(new Set(stable.map((h) => h.color)).size).toBe(20)

    // The colour is what is drawn: silks in the list and coats on the track are all distinct.
    const silks = await ui(page)
      .stable.locator('.silk rect:first-child')
      .evaluateAll((rects) => rects.map((r) => r.getAttribute('fill')))
    expect(new Set(silks).size).toBe(20)

    await ui(page).generate.click()
    const coats = await page
      .locator('.run')
      .evaluateAll((runs) => runs.map((r) => (r as HTMLElement).style.getPropertyValue('--coat')))
    expect(coats).toHaveLength(10)
    expect(new Set(coats).size).toBe(10)
  })

  test('3. each horse has a condition score from 1 to 100', async ({ page }) => {
    for (const seed of [SEED, 1, 999_999]) {
      await visit(page, `/?seed=${seed}`)
      const meters = ui(page).stable.getByRole('meter')
      await expect(meters).toHaveCount(20)
      for (const meter of await meters.all()) {
        await expect(meter).toHaveAttribute('min', '1')
        await expect(meter).toHaveAttribute('max', '100')
      }
      const conditions = (await horses(page)).map((h) => h.condition)
      for (const c of conditions) {
        expect(Number.isInteger(c) && c >= 1 && c <= 100, `condition ${c}`).toBe(true)
      }
    }
  })

  test('4. each race day consists of 6 rounds', async ({ page }) => {
    await expect(ui(page).summary).toContainText('6 rounds')
    await expect(ui(page).race.getByRole('list', { name: '0 of 6 rounds finished' })).toBeAttached()
    await ui(page).generate.click()
    await expect(ui(page).program.locator('details')).toHaveCount(6)
    await expect(ui(page).program).toContainText('6 rounds')
  })

  test('5. each round draws 10 random horses from the 20', async ({ page }) => {
    const stable = new Set((await horses(page)).map((h) => h.name))
    await ui(page).generate.click()
    const rounds = await program(page)

    for (const round of rounds) {
      expect(round.entrants, round.title).toHaveLength(10)
      expect(new Set(round.entrants).size, `${round.title} has no repeats`).toBe(10)
      for (const name of round.entrants)
        expect(stable.has(name), `${name} is in the stable`).toBe(true)
    }
    // Random draws: the six line-ups are not all the same field.
    const fields = new Set(rounds.map((r) => [...r.entrants].sort().join()))
    expect(fields.size).toBeGreaterThan(1)

    // A new program is a new draw.
    await ui(page).generate.click()
    expect(await program(page)).not.toEqual(rounds)
  })

  test('6. rounds run 1200, 1400, 1600, 1800, 2000 and 2200 metres, in that order', async ({
    page,
  }) => {
    test.slow()
    const { generate, speed, start, race } = ui(page)
    await generate.click()
    expect((await program(page)).map((r) => r.title)).toEqual(roundTitles)

    // The track runs them in that order too.
    await speed(4).click()
    await start.click()
    const seen: string[] = []
    for (let i = 0; i < 300 && seen.length < 6; i++) {
      const title = (await race.getByRole('heading', { level: 2 }).textContent())!.trim()
      if (title !== seen.at(-1)) seen.push(title)
      await tick(page, 250)
    }
    expect(seen).toEqual(roundTitles)
    await raceUntilResults(page, 6)
    await expect(resultTitles(page)).toHaveText([...roundTitles].reverse())
  })
})
