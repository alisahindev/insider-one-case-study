import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { COUNTDOWN_SECONDS, HORSE_COUNT, ROUND_DISTANCES } from '../../domain/config'
import { RACE_TIME_SCALE, useRaceStore } from '../race'

/** Burns the countdown, then runs the race clock past the slowest finisher. */
function runRound(store: ReturnType<typeof useRaceStore>) {
  store.tick(COUNTDOWN_SECONDS)
  store.tick(1_000)
}

describe('race store', () => {
  let store: ReturnType<typeof useRaceStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useRaceStore()
    store.setSeed(1)
  })

  it('starts idle with 20 horses and no program', () => {
    expect(store.status).toBe('idle')
    expect(store.horses).toHaveLength(HORSE_COUNT)
    expect(store.schedule).toEqual([])
  })

  it('generates a 6 round program', () => {
    store.generate(7)
    expect(store.status).toBe('ready')
    expect(store.schedule.map((r) => r.distance)).toEqual([...ROUND_DISTANCES])
  })

  it('is fully reproducible from the seeds', () => {
    store.generate(7)
    const first = JSON.stringify([store.horses, store.schedule, store.placings])

    setActivePinia(createPinia())
    const other = useRaceStore()
    other.setSeed(1)
    other.generate(7)
    expect(JSON.stringify([other.horses, other.schedule, other.placings])).toBe(first)
  })

  it('does not move while not racing', () => {
    store.generate(7)
    store.tick(10)
    expect(store.countdown).toBe(COUNTDOWN_SECONDS)
    expect(store.elapsed).toBe(0)
  })

  it('counts down before the race clock starts', () => {
    store.generate(7)
    store.start()
    store.tick(1)
    expect(store.countdown).toBe(COUNTDOWN_SECONDS - 1)
    expect(store.elapsed).toBe(0)
    store.tick(COUNTDOWN_SECONDS)
    store.tick(1)
    expect(store.elapsed).toBe(RACE_TIME_SCALE)
  })

  it('applies the playback speed', () => {
    store.generate(7)
    store.setSpeed(4)
    store.start()
    store.tick(COUNTDOWN_SECONDS)
    store.tick(1)
    expect(store.elapsed).toBe(4 * RACE_TIME_SCALE)
  })

  it('pauses and resumes', () => {
    store.generate(7)
    store.start()
    store.tick(COUNTDOWN_SECONDS)
    store.toggle()
    expect(store.status).toBe('paused')
    store.tick(5)
    expect(store.elapsed).toBe(0)
    store.toggle()
    expect(store.status).toBe('racing')
  })

  it('records results round by round, in order', () => {
    store.generate(7)
    store.start()
    runRound(store)
    expect(store.results).toHaveLength(1)
    expect(store.results[0]!.roundNumber).toBe(1)
    expect(store.roundIndex).toBe(1)
    expect(store.countdown).toBe(COUNTDOWN_SECONDS)

    for (let i = 1; i < ROUND_DISTANCES.length; i++) runRound(store)
    expect(store.status).toBe('finished')
    expect(store.results.map((r) => r.distance)).toEqual([...ROUND_DISTANCES])
    for (const result of store.results) {
      const times = result.placings.map((p) => p.time)
      expect(times).toEqual([...times].sort((a, b) => a - b))
    }
  })

  it('orders live standings by progress and finishers by time', () => {
    store.generate(7)
    store.start()
    store.tick(COUNTDOWN_SECONDS)
    store.tick(2)
    const distances = store.standings.map((s) => s.distance)
    expect(distances).toEqual([...distances].sort((a, b) => b - a))

    store.elapsed = store.roundDuration
    expect(store.standings.map((s) => s.horseId)).toEqual(store.placings.map((p) => p.horseId))
  })

  it('reports each round as done, live or upcoming', () => {
    store.generate(7)
    expect(store.roundState(1)).toBe('upcoming')
    store.start()
    expect(store.roundState(1)).toBe('live')
    runRound(store)
    expect([1, 2, 3].map(store.roundState)).toEqual(['done', 'live', 'upcoming'])
  })

  it('replays the same programs for the same seed', () => {
    store.generate()
    const first = store.programSeed
    store.setSeed(1)
    store.generate()
    expect(store.programSeed).toBe(first)
  })

  it('starts a fresh program when started from idle or after finishing', () => {
    store.start()
    expect(store.status).toBe('racing')
    expect(store.schedule).toHaveLength(ROUND_DISTANCES.length)

    for (let i = 0; i < ROUND_DISTANCES.length; i++) runRound(store)
    const previousProgram = store.programSeed
    store.start()
    expect(store.results).toEqual([])
    expect(store.programSeed).not.toBe(previousProgram)
  })
})
