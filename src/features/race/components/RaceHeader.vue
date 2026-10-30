<script setup lang="ts">
import { computed } from 'vue'
import { ROUND_DISTANCES } from '../domain/config'
import { useRaceStore } from '../stores/race'
import { formatRaceTime } from '../utils/format'

const race = useRaceStore()

const title = computed(() => {
  const round = race.currentRound
  return round ? `Round ${round.number} · ${round.distance}m` : 'Race day'
})

const subtitle = computed(() => {
  switch (race.status) {
    case 'idle':
      return 'Generate a program to draw the field for six rounds.'
    case 'ready':
      return 'The program is set. Press Start when you are ready.'
    case 'finished':
      return 'All six rounds are in. Check the results.'
    default:
      return `${race.runners.length} runners · ${formatRaceTime(race.elapsed)}`
  }
})
</script>

<template>
  <div class="race-header">
    <h2 class="title">{{ title }}</h2>
    <p class="subtitle">{{ subtitle }}</p>
    <ol
      class="progress"
      :aria-label="`${race.results.length} of ${ROUND_DISTANCES.length} rounds finished`"
    >
      <li v-for="(_, i) in ROUND_DISTANCES" :key="i" :class="race.roundState(i + 1)" />
    </ol>
  </div>
</template>

<style scoped>
.race-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-2) var(--space-4);
}

.title {
  font-size: var(--text-display);
  font-weight: 800;
  font-stretch: var(--stretch-wide);
  line-height: 1;
  letter-spacing: -0.02em;
}

.subtitle {
  padding-bottom: 3px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.progress {
  display: flex;
  gap: var(--space-1);
  margin-left: auto;
  padding-bottom: 6px;
}

.progress li {
  width: 28px;
  height: 6px;
  border-radius: 3px;
  background: var(--border);
  transition: background var(--duration) var(--ease-out);
}

.progress .done {
  background: var(--accent);
}

.progress .live {
  background: var(--color-brass);
}
</style>
