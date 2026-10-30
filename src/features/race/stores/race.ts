import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { COUNTDOWN_SECONDS } from '../domain/config'
import { createHorses } from '../domain/horses'
import { createRunners, distanceAt, rankRunners } from '../domain/race'
import { createRng, randomSeed } from '../domain/random'
import { createSchedule } from '../domain/schedule'
import type { RoundResult } from '../domain/types'

export type RaceStatus = 'idle' | 'ready' | 'racing' | 'paused' | 'finished'
export type RoundState = 'done' | 'live' | 'upcoming'

/** Race seconds simulated per real second at 1x, so a 70 s race plays in ~12 s. */
export const RACE_TIME_SCALE = 6
export const SPEED_OPTIONS = [1, 2, 4] as const
export type Speed = (typeof SPEED_OPTIONS)[number]

export interface Standing {
  horseId: number
  distance: number
  finishTime: number
  finished: boolean
}

export const useRaceStore = defineStore('race', () => {
  const seed = ref(randomSeed())
  const programSeed = ref<number | null>(null)
  const status = ref<RaceStatus>('idle')
  const roundIndex = ref(0)
  const countdown = ref(0)
  /** Race clock of the current round, in simulated seconds. */
  const elapsed = ref(0)
  const speed = ref<Speed>(1)
  const results = ref<RoundResult[]>([])
  // Not state: a private source of program seeds, so `?seed=` replays the whole race day.
  let programRng = createRng(seed.value)

  // Everything below is derived from the seeds, so a seed fully reproduces a race day.
  const horses = computed(() => createHorses(createRng(seed.value)))
  const horsesById = computed(() => new Map(horses.value.map((horse) => [horse.id, horse])))

  const schedule = computed(() =>
    programSeed.value === null ? [] : createSchedule(createRng(programSeed.value), horses.value),
  )
  const currentRound = computed(() => schedule.value[roundIndex.value])

  const runners = computed(() => {
    const round = currentRound.value
    if (!round || programSeed.value === null) return []
    const entrants = round.horseIds.map((id) => horsesById.value.get(id)!)
    return createRunners(createRng(programSeed.value + round.number), entrants)
  })
  const placings = computed(() =>
    currentRound.value ? rankRunners(runners.value, currentRound.value.distance) : [],
  )
  const finishTimes = computed(() => new Map(placings.value.map((p) => [p.horseId, p.time])))
  const roundDuration = computed(() => placings.value[placings.value.length - 1]?.time ?? 0)

  /** Live order on the track: finishers by time, then the rest by distance covered. */
  const standings = computed<Standing[]>(() => {
    const distance = currentRound.value?.distance ?? 0
    return runners.value
      .map((runner) => {
        const finishTime = finishTimes.value.get(runner.horseId)!
        const finished = elapsed.value >= finishTime
        return {
          horseId: runner.horseId,
          distance: finished ? distance : distanceAt(runner, elapsed.value),
          finishTime,
          finished,
        }
      })
      .sort((a, b) =>
        a.finished && b.finished ? a.finishTime - b.finishTime : b.distance - a.distance,
      )
  })

  function roundState(number: number): RoundState {
    if (number <= results.value.length) return 'done'
    const isLive = status.value === 'racing' || status.value === 'paused'
    return isLive && number === currentRound.value?.number ? 'live' : 'upcoming'
  }

  function setSeed(value: number) {
    seed.value = value
    programRng = createRng(value)
    programSeed.value = null
    status.value = 'idle'
    results.value = []
  }

  function generate(value = randomSeed(programRng)) {
    programSeed.value = value
    roundIndex.value = 0
    elapsed.value = 0
    countdown.value = COUNTDOWN_SECONDS
    results.value = []
    status.value = 'ready'
  }

  function start() {
    if (status.value === 'idle' || status.value === 'finished') generate()
    status.value = 'racing'
  }

  function pause() {
    if (status.value === 'racing') status.value = 'paused'
  }

  function toggle() {
    if (status.value === 'racing') pause()
    else start()
  }

  function setSpeed(value: Speed) {
    speed.value = value
  }

  /** Advances the race by `seconds` of real time; driven by the animation loop. */
  function tick(seconds: number) {
    if (status.value !== 'racing') return
    const step = seconds * speed.value
    if (countdown.value > 0) {
      countdown.value = Math.max(0, countdown.value - step)
      return
    }
    elapsed.value = Math.min(elapsed.value + step * RACE_TIME_SCALE, roundDuration.value)
    if (elapsed.value >= roundDuration.value) finishRound()
  }

  function finishRound() {
    const round = currentRound.value!
    results.value.push({
      roundNumber: round.number,
      distance: round.distance,
      placings: placings.value,
    })
    if (roundIndex.value < schedule.value.length - 1) {
      roundIndex.value++
      elapsed.value = 0
      countdown.value = COUNTDOWN_SECONDS
    } else {
      status.value = 'finished'
    }
  }

  return {
    seed,
    programSeed,
    status,
    roundIndex,
    countdown,
    elapsed,
    speed,
    results,
    horses,
    horsesById,
    schedule,
    currentRound,
    runners,
    placings,
    roundDuration,
    standings,
    roundState,
    setSeed,
    generate,
    start,
    pause,
    toggle,
    setSpeed,
    tick,
  }
})
