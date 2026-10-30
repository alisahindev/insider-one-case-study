import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { COUNTDOWN_SECONDS } from '../../domain/config'
import { mountWithRace } from '../../components/__tests__/mountWithRace'
import { useRaceLoop } from '../useRaceLoop'

enableAutoUnmount(afterEach)

const Host = defineComponent({
  setup: () => useRaceLoop(),
  render: () => null,
})

describe('useRaceLoop', () => {
  beforeEach(() =>
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] }),
  )
  afterEach(() => vi.useRealTimers())

  it('advances the race in real time only while racing', async () => {
    const { race } = mountWithRace(Host)
    race.start()
    await nextTick()

    vi.advanceTimersByTime(1000)
    expect(race.countdown).toBeCloseTo(COUNTDOWN_SECONDS - 1, 1)

    race.pause()
    await nextTick()
    vi.advanceTimersByTime(1000)
    expect(race.countdown).toBeCloseTo(COUNTDOWN_SECONDS - 1, 1)
  })

  it('stops scheduling frames when the component unmounts', async () => {
    const { race, wrapper } = mountWithRace(Host)
    race.start()
    await nextTick()
    wrapper.unmount()
    vi.advanceTimersByTime(1000)
    expect(race.countdown).toBe(COUNTDOWN_SECONDS)
  })
})
