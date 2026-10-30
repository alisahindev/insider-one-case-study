import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COUNTDOWN_SECONDS } from '../../domain/config'
import { createHorses } from '../../domain/horses'
import { createRng } from '../../domain/random'
import { DEFAULT_SETTINGS, type RaceSettings } from '../../domain/settings'
import { RACE_TIME_SCALE, useRaceStore } from '../race'

type RaceStore = ReturnType<typeof useRaceStore>

/** A store on a fixed race day, so every run is reproducible. */
function seeded(overrides: Partial<RaceSettings> = {}) {
  const race = useRaceStore()
  race.newRaceDay({ ...DEFAULT_SETTINGS, seed: 1, ...overrides })
  return race
}

/** Burns the countdown, then runs the race clock past the slowest finisher. */
function runRound(race: RaceStore) {
  race.tick(COUNTDOWN_SECONDS)
  race.tick(1_000)
}

function runAllRounds(race: RaceStore) {
  while (race.status === 'racing') runRound(race)
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('race store before anything happens', () => {
  it('is idle with the default stable and no program', () => {
    const race = useRaceStore()
    expect(race.status).toBe('idle')
    expect(race.settings).toEqual(DEFAULT_SETTINGS)
    expect(race.horses).toHaveLength(20)
    expect(race.programSeed).toBeNull()
    expect(race.schedule).toEqual([])
    expect(race.results).toEqual([])
    expect(race.speed).toBe(1)
  })

  it('has no round, runners or standings yet', () => {
    const race = useRaceStore()
    expect(race.currentRound).toBeUndefined()
    expect(race.runners).toEqual([])
    expect(race.placings).toEqual([])
    expect(race.standings).toEqual([])
    expect(race.roundDuration).toBe(0)
    expect(race.roundCount).toBe(6)
  })

  it('draws its first stable from a random six-digit seed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(useRaceStore().seed).toBe(500_000)
  })
})

describe('newRaceDay', () => {
  it('builds the stable from the settings and seed', () => {
    const race = seeded({ horseCount: 7, seed: 77 })
    expect(race.seed).toBe(77)
    expect(race.horses).toEqual(createHorses(createRng(77), 7))
  })

  it('indexes horses by id', () => {
    const race = seeded()
    for (const horse of race.horses) expect(race.horsesById.get(horse.id)).toBe(horse)
  })

  it('draws a random seed when the settings have none', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const race = seeded({ seed: null })
    expect(race.seed).toBe(250_000)
  })

  it('takes the playback speed from the settings', () => {
    expect(seeded({ speed: 4 }).speed).toBe(4)
  })

  it('throws away the program and results of the previous day', () => {
    const race = seeded()
    race.start()
    runRound(race)
    race.newRaceDay({ ...DEFAULT_SETTINGS, seed: 2 })
    expect(race.status).toBe('idle')
    expect(race.programSeed).toBeNull()
    expect(race.schedule).toEqual([])
    expect(race.results).toEqual([])
    expect(race.roundIndex).toBe(0)
    expect(race.elapsed).toBe(0)
  })

  it('replays an identical race day for the same seed', () => {
    const first = seeded({ seed: 31337 })
    first.start()
    runAllRounds(first)
    const snapshot = JSON.stringify([first.horses, first.schedule, first.results])

    setActivePinia(createPinia())
    const second = seeded({ seed: 31337 })
    second.start()
    runAllRounds(second)
    expect(JSON.stringify([second.horses, second.schedule, second.results])).toBe(snapshot)
  })

  it('creates a different stable for a different seed', () => {
    const a = seeded({ seed: 1 }).horses
    setActivePinia(createPinia())
    expect(seeded({ seed: 2 }).horses).not.toEqual(a)
  })
})

describe('generate', () => {
  it('creates the six-round program from the assignment', () => {
    const race = seeded()
    race.generate()
    expect(race.status).toBe('ready')
    expect(race.schedule.map((r) => r.distance)).toEqual([1200, 1400, 1600, 1800, 2000, 2200])
    for (const round of race.schedule) expect(new Set(round.horseIds).size).toBe(10)
  })

  it('follows custom settings', () => {
    const race = seeded({ horseCount: 5, horsesPerRound: 3, distances: [400, 3200] })
    race.generate()
    expect(race.roundCount).toBe(2)
    expect(race.schedule.map((r) => [r.distance, r.horseIds.length])).toEqual([
      [400, 3],
      [3200, 3],
    ])
  })

  it('uses an explicit program seed when given one', () => {
    const race = seeded()
    race.generate(1234)
    expect(race.programSeed).toBe(1234)
  })

  it('draws a new program every time', () => {
    const race = seeded()
    race.generate()
    const first = race.programSeed
    race.generate()
    expect(race.programSeed).not.toBe(first)
  })

  it('replays the same sequence of programs for the same day seed', () => {
    const race = seeded()
    race.generate()
    const first = race.programSeed
    race.generate()
    const second = race.programSeed

    race.newRaceDay({ ...DEFAULT_SETTINGS, seed: 1 })
    race.generate()
    expect(race.programSeed).toBe(first)
    race.generate()
    expect(race.programSeed).toBe(second)
  })

  it('arms the countdown only when the settings ask for one', () => {
    const withCountdown = seeded()
    withCountdown.generate()
    expect(withCountdown.countdown).toBe(COUNTDOWN_SECONDS)

    const without = seeded({ countdown: false })
    without.generate()
    expect(without.countdown).toBe(0)
  })

  it('stops a running race and clears its results', () => {
    const race = seeded()
    race.start()
    runRound(race)
    race.tick(COUNTDOWN_SECONDS)
    race.tick(1)
    race.generate()
    expect(race.status).toBe('ready')
    expect(race.results).toEqual([])
    expect(race.roundIndex).toBe(0)
    expect(race.elapsed).toBe(0)
  })
})

describe('start, pause and toggle', () => {
  it('generates a program first when started from idle', () => {
    const race = seeded()
    race.start()
    expect(race.status).toBe('racing')
    expect(race.schedule).toHaveLength(6)
    expect(race.countdown).toBe(COUNTDOWN_SECONDS)
  })

  it('races the program that was generated when started from ready', () => {
    const race = seeded()
    race.generate(55)
    race.start()
    expect(race.status).toBe('racing')
    expect(race.programSeed).toBe(55)
  })

  it('keeps the same program when start is pressed mid-race', () => {
    const race = seeded()
    race.start()
    const program = race.programSeed
    race.start()
    expect(race.programSeed).toBe(program)
  })

  it('pauses a running race', () => {
    const race = seeded()
    race.start()
    race.pause()
    expect(race.status).toBe('paused')
  })

  it.each(['idle', 'ready'] as const)('ignores pause while %s', (status) => {
    const race = seeded()
    if (status === 'ready') race.generate()
    race.pause()
    expect(race.status).toBe(status)
  })

  it('ignores pause once the race day is finished', () => {
    const race = seeded()
    race.start()
    runAllRounds(race)
    race.pause()
    expect(race.status).toBe('finished')
  })

  it('resumes a paused race where it left off', () => {
    const race = seeded({ countdown: false })
    race.start()
    race.tick(1)
    const program = race.programSeed
    race.pause()
    race.start()
    expect(race.status).toBe('racing')
    expect(race.programSeed).toBe(program)
    expect(race.elapsed).toBe(RACE_TIME_SCALE)
  })

  it('starts a fresh program when started after the last round', () => {
    const race = seeded()
    race.start()
    runAllRounds(race)
    const previous = race.programSeed
    race.start()
    expect(race.status).toBe('racing')
    expect(race.programSeed).not.toBe(previous)
    expect(race.results).toEqual([])
    expect(race.roundIndex).toBe(0)
  })

  it.each([
    ['idle', 'racing'],
    ['ready', 'racing'],
    ['racing', 'paused'],
    ['paused', 'racing'],
    ['finished', 'racing'],
  ] as const)('toggle turns %s into %s', (from, to) => {
    const race = seeded()
    if (from === 'ready') race.generate()
    if (from === 'racing' || from === 'paused') race.start()
    if (from === 'paused') race.pause()
    if (from === 'finished') {
      race.start()
      runAllRounds(race)
    }
    expect(race.status).toBe(from)
    race.toggle()
    expect(race.status).toBe(to)
  })
})

describe('tick', () => {
  it.each(['idle', 'ready', 'paused'] as const)('does nothing while %s', (status) => {
    const race = seeded()
    if (status !== 'idle') race.generate()
    if (status === 'paused') {
      race.start()
      race.pause()
    }
    const countdown = race.countdown
    race.tick(10)
    expect(race.countdown).toBe(countdown)
    expect(race.elapsed).toBe(0)
    expect(race.status).toBe(status)
  })

  it('does nothing once the race day is finished', () => {
    const race = seeded()
    race.start()
    runAllRounds(race)
    race.tick(1_000)
    expect(race.results).toHaveLength(6)
    expect(race.status).toBe('finished')
  })

  it('runs the countdown before the race clock', () => {
    const race = seeded()
    race.start()
    race.tick(1)
    expect(race.countdown).toBe(COUNTDOWN_SECONDS - 1)
    expect(race.elapsed).toBe(0)
  })

  it('starts the race clock once the countdown is over', () => {
    const race = seeded()
    race.start()
    race.tick(COUNTDOWN_SECONDS)
    expect(race.countdown).toBe(0)
    race.tick(1)
    expect(race.elapsed).toBe(RACE_TIME_SCALE)
  })

  it('drops time left over from the countdown instead of moving the horses', () => {
    const race = seeded()
    race.start()
    race.tick(COUNTDOWN_SECONDS + 5)
    expect(race.countdown).toBe(0)
    expect(race.elapsed).toBe(0)
  })

  it('starts the race clock straight away without a countdown', () => {
    const race = seeded({ countdown: false })
    race.start()
    race.tick(1)
    expect(race.elapsed).toBe(RACE_TIME_SCALE)
  })

  it('simulates RACE_TIME_SCALE race seconds per real second at 1x', () => {
    expect(RACE_TIME_SCALE).toBe(6)
    const race = seeded({ countdown: false })
    race.start()
    race.tick(0.5)
    expect(race.elapsed).toBe(0.5 * RACE_TIME_SCALE)
  })

  it.each([2, 4] as const)('runs the race clock %ix faster at %ix speed', (speed) => {
    const race = seeded({ countdown: false })
    race.setSpeed(speed)
    race.start()
    race.tick(1)
    expect(race.elapsed).toBe(speed * RACE_TIME_SCALE)
  })

  it('speeds up the countdown too', () => {
    const race = seeded()
    race.setSpeed(2)
    race.start()
    race.tick(1)
    expect(race.countdown).toBe(COUNTDOWN_SECONDS - 2)
  })

  it('takes a speed change mid-race into account from the next tick', () => {
    const race = seeded({ countdown: false })
    race.start()
    race.tick(1)
    race.setSpeed(4)
    race.tick(1)
    expect(race.elapsed).toBe(5 * RACE_TIME_SCALE)
  })

  it('keeps a round open until the slowest horse finishes', () => {
    const race = seeded({ countdown: false })
    race.start()
    race.elapsed = race.roundDuration - 1
    race.tick(0.1)
    expect(race.results).toHaveLength(0)
    expect(race.roundIndex).toBe(0)
  })

  it('stops the race clock at the last finish and moves to the next round', () => {
    const race = seeded()
    race.start()
    const placings = race.placings
    runRound(race)
    expect(race.results).toEqual([{ roundNumber: 1, distance: 1200, placings }])
    expect(race.roundIndex).toBe(1)
    expect(race.elapsed).toBe(0)
    expect(race.countdown).toBe(COUNTDOWN_SECONDS)
    expect(race.status).toBe('racing')
  })

  it('finishes at most one round per tick, however large the tick', () => {
    const race = seeded({ countdown: false })
    race.start()
    race.tick(1e9)
    expect(race.results).toHaveLength(1)
    race.tick(Number.MAX_VALUE)
    expect(race.results).toHaveLength(2)
  })

  it('publishes results one round at a time, in round order', () => {
    const race = seeded()
    race.start()
    for (let round = 1; round <= 6; round++) {
      expect(race.results).toHaveLength(round - 1)
      runRound(race)
      expect(race.results.map((r) => r.roundNumber)).toEqual(
        Array.from({ length: round }, (_, i) => i + 1),
      )
    }
  })

  it('finishes the race day after the last round', () => {
    const race = seeded()
    race.start()
    for (let i = 0; i < 5; i++) runRound(race)
    expect(race.status).toBe('racing')
    runRound(race)
    expect(race.status).toBe('finished')
    expect(race.results.map((r) => r.distance)).toEqual([1200, 1400, 1600, 1800, 2000, 2200])
  })

  it('places every entrant exactly once, fastest first, in every result', () => {
    const race = seeded()
    race.start()
    runAllRounds(race)
    race.results.forEach((result, i) => {
      const times = result.placings.map((p) => p.time)
      expect(times).toEqual([...times].sort((a, b) => a - b))
      expect(result.placings.map((p) => p.horseId).sort()).toEqual(
        [...race.schedule[i]!.horseIds].sort(),
      )
    })
  })

  it('runs a customised day with one horse and one short round', () => {
    const race = seeded({ horseCount: 1, horsesPerRound: 1, distances: [400] })
    race.start()
    runRound(race)
    expect(race.status).toBe('finished')
    expect(race.results).toEqual([
      { roundNumber: 1, distance: 400, placings: [{ horseId: 1, time: expect.any(Number) }] },
    ])
  })

  it('runs a customised day with ten rounds', () => {
    const distances = [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 3200]
    const race = seeded({ horseCount: 12, horsesPerRound: 12, distances })
    race.start()
    runAllRounds(race)
    expect(race.results.map((r) => r.distance)).toEqual(distances)
    for (const result of race.results) expect(result.placings).toHaveLength(12)
  })
})

describe('current round', () => {
  it('follows the round index', () => {
    const race = seeded()
    race.start()
    expect(race.currentRound).toEqual(race.schedule[0])
    runRound(race)
    expect(race.currentRound).toEqual(race.schedule[1])
  })

  it('has one runner per entrant', () => {
    const race = seeded()
    race.start()
    expect(race.runners.map((r) => r.horseId)).toEqual(race.currentRound!.horseIds)
  })

  it('ranks the entrants in finishing order and lasts until the slowest one finishes', () => {
    const race = seeded()
    race.start()
    const times = race.placings.map((p) => p.time)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(race.roundDuration).toBe(times[times.length - 1])
  })
})

describe('standings', () => {
  it('lists every runner, all at the start, before the race clock moves', () => {
    const race = seeded()
    race.start()
    expect(race.standings).toHaveLength(10)
    for (const s of race.standings) expect(s).toMatchObject({ distance: 0, finished: false })
  })

  it('orders horses still running by distance covered', () => {
    const race = seeded({ countdown: false })
    race.start()
    race.tick(2)
    const distances = race.standings.map((s) => s.distance)
    expect(distances).toEqual([...distances].sort((a, b) => b - a))
    expect(distances[0]).toBeGreaterThan(0)
  })

  it('puts finishers first, by finish time, at the full distance', () => {
    const race = seeded({ countdown: false })
    race.start()
    const placings = race.placings
    race.elapsed = (placings[2]!.time + placings[3]!.time) / 2
    const [first, second, third, fourth] = race.standings
    expect([first, second, third].map((s) => s!.horseId)).toEqual(
      placings.slice(0, 3).map((p) => p.horseId),
    )
    for (const s of [first, second, third])
      expect(s).toMatchObject({ finished: true, distance: 1200 })
    expect(fourth).toMatchObject({ finished: false })
    expect(fourth!.distance).toBeLessThan(1200)
  })

  it('matches the official placings once everyone has finished', () => {
    const race = seeded()
    race.start()
    race.elapsed = race.roundDuration
    expect(race.standings.map((s) => s.horseId)).toEqual(race.placings.map((p) => p.horseId))
    expect(race.standings.every((s) => s.finished)).toBe(true)
  })
})

describe('roundState', () => {
  it('marks every round upcoming before the races start', () => {
    const race = seeded()
    expect([1, 2, 6].map(race.roundState)).toEqual(['upcoming', 'upcoming', 'upcoming'])
    race.generate()
    expect([1, 2, 6].map(race.roundState)).toEqual(['upcoming', 'upcoming', 'upcoming'])
  })

  it('marks the current round live while racing and while paused', () => {
    const race = seeded()
    race.start()
    expect(race.roundState(1)).toBe('live')
    race.pause()
    expect(race.roundState(1)).toBe('live')
    expect(race.roundState(2)).toBe('upcoming')
  })

  it('marks finished rounds done', () => {
    const race = seeded()
    race.start()
    runRound(race)
    runRound(race)
    expect([1, 2, 3, 4].map(race.roundState)).toEqual(['done', 'done', 'live', 'upcoming'])
  })

  it('marks every round done once the day is finished', () => {
    const race = seeded()
    race.start()
    runAllRounds(race)
    expect([1, 2, 3, 4, 5, 6].map(race.roundState)).toEqual(Array(6).fill('done'))
  })
})
