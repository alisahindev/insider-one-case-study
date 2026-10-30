<script setup lang="ts">
import { computed } from 'vue'
import { useRaceStore } from '../stores/race'
import { pluralize } from '../utils/format'

const race = useRaceStore()

const title = computed(() => {
  const round = race.currentRound
  return round ? `Round ${round.number} · ${round.distance}m` : 'Race day'
})

// Only live facts here; the track notice already says what to do next.
const isLive = computed(() => race.status === 'racing' || race.status === 'paused')
// Race time runs RACE_TIME_SCALE× faster than real time, so even tenths would change every
// frame: unreadable, and each text change costs a layout. Whole seconds tick a few times a second.
const clock = computed(() => {
  const seconds = Math.floor(race.elapsed)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})
</script>

<template>
  <div class="race-header">
    <div>
      <h2 class="title">{{ title }}</h2>
      <p v-if="isLive" class="subtitle">
        {{ race.runners.length }} {{ pluralize(race.runners.length, 'runner') }} · {{ clock }}
      </p>
    </div>
    <ol
      class="progress"
      :aria-label="`${race.results.length} of ${race.roundCount} rounds finished`"
    >
      <li v-for="n in race.roundCount" :key="n" :class="race.roundState(n)" />
    </ol>
  </div>
</template>

<style scoped>
.race-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
}

.title {
  font-size: var(--text-display);
  font-weight: 600;
  line-height: 1.15;
}

.subtitle {
  margin-top: 2px;
  color: var(--text-muted);
}

.progress {
  display: flex;
  gap: var(--space-1);
  padding-bottom: 6px;
}

.progress li {
  width: 24px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  transition: background var(--duration) var(--ease-out);
}

.progress .done {
  background: var(--text);
}

.progress .live {
  background: var(--accent);
}
</style>
