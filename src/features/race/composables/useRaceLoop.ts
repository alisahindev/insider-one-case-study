import { onScopeDispose, watch } from 'vue'
import { useRaceStore } from '../stores/race'

// A hidden tab pauses rAF; cap the catch-up step so the race resumes instead of jumping ahead.
const MAX_STEP_SECONDS = 0.1

/** Drives the race store with requestAnimationFrame while a race is running. */
export function useRaceLoop() {
  const race = useRaceStore()
  let frame = 0
  let last = 0

  function loop(now: number) {
    race.tick(Math.min((now - last) / 1000, MAX_STEP_SECONDS))
    last = now
    frame = requestAnimationFrame(loop)
  }

  watch(
    () => race.status === 'racing',
    (racing) => {
      cancelAnimationFrame(frame)
      if (!racing) return
      last = performance.now()
      frame = requestAnimationFrame(loop)
    },
    { immediate: true },
  )

  onScopeDispose(() => cancelAnimationFrame(frame))
}
