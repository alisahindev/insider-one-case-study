import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'
import { COUNTDOWN_SECONDS } from '../../domain/config'
import { DEFAULT_SETTINGS } from '../../domain/settings'
import { useRaceStore } from '../../stores/race'
import { useRaceLoop } from '../useRaceLoop'

// A hand-driven requestAnimationFrame: frames only run when a test calls `frame(time)`.
let pending = new Map<number, FrameRequestCallback>()
let nextId = 1
let clock = 0

function frame(time: number) {
  clock = time
  const callbacks = [...pending.values()]
  pending = new Map()
  for (const callback of callbacks) callback(time)
}

let race: ReturnType<typeof useRaceStore>
let tick: MockInstance
let scope: EffectScope

function mountLoop() {
  scope = effectScope()
  scope.run(() => useRaceLoop())
}

beforeEach(() => {
  pending = new Map()
  clock = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pending.set(nextId, callback)
    return nextId++
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id))
  vi.spyOn(performance, 'now').mockImplementation(() => clock)

  setActivePinia(createPinia())
  race = useRaceStore()
  race.newRaceDay({ ...DEFAULT_SETTINGS, seed: 1 })
  tick = vi.spyOn(race, 'tick')
})

afterEach(() => {
  scope?.stop()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useRaceLoop', () => {
  it('does not request frames while the race is not running', () => {
    mountLoop()
    expect(pending.size).toBe(0)
  })

  it('starts the loop when the race starts', async () => {
    mountLoop()
    race.start()
    await nextTick()
    expect(pending.size).toBe(1)
  })

  it('starts at once when the race is already running', () => {
    race.start()
    mountLoop()
    expect(pending.size).toBe(1)
  })

  it('advances the race by the real time between frames, in seconds', async () => {
    mountLoop()
    race.start()
    await nextTick()
    frame(16)
    frame(48)
    expect(tick.mock.calls).toEqual([[0.016], [0.032]])
  })

  it('moves the race in real time', async () => {
    mountLoop()
    race.start()
    await nextTick()
    for (let t = 50; t <= 1000; t += 50) frame(t)
    expect(race.countdown).toBeCloseTo(COUNTDOWN_SECONDS - 1, 6)
  })

  it('caps a long gap between frames at 0.1 s so a hidden tab does not jump ahead', async () => {
    mountLoop()
    race.start()
    await nextTick()
    frame(5000)
    expect(tick).toHaveBeenLastCalledWith(0.1)
  })

  it('stops when the race is paused', async () => {
    mountLoop()
    race.start()
    await nextTick()
    frame(16)
    race.pause()
    await nextTick()
    expect(pending.size).toBe(0)
    frame(32)
    expect(tick).toHaveBeenCalledTimes(1)
  })

  it('measures the first frame after resuming from the resume, not from before the pause', async () => {
    mountLoop()
    race.start()
    await nextTick()
    frame(16)
    race.pause()
    await nextTick()
    clock = 10_000
    race.start()
    await nextTick()
    frame(10_020)
    expect(tick).toHaveBeenLastCalledWith(0.02)
  })

  it('stops after the last round finishes', async () => {
    race.newRaceDay({ ...DEFAULT_SETTINGS, seed: 1, countdown: false, distances: [400], speed: 4 })
    tick = vi.spyOn(race, 'tick')
    mountLoop()
    race.start()
    await nextTick()
    for (let t = 100; race.status === 'racing' && t < 100_000; t += 100) frame(t)
    expect(race.status).toBe('finished')
    await nextTick()
    expect(pending.size).toBe(0)
  })

  it('stops when its owner is disposed', async () => {
    mountLoop()
    race.start()
    await nextTick()
    scope.stop()
    expect(pending.size).toBe(0)
    frame(16)
    expect(tick).not.toHaveBeenCalled()
  })

  it('never passes a negative step when the frame time is earlier than the start time', async () => {
    // Chromium can stamp a frame with a time before the performance.now() read in the watcher.
    clock = 100
    mountLoop()
    race.start()
    await nextTick()
    frame(95)
    expect(tick.mock.calls[0]![0]).toBeGreaterThanOrEqual(0)
  })
})
