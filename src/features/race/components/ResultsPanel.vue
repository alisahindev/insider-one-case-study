<script setup lang="ts">
import { computed } from 'vue'
import { ROUND_DISTANCES } from '../domain/config'
import { useRaceStore } from '../stores/race'
import { formatGap, formatRaceTime } from '../utils/format'
import SilkIcon from './SilkIcon.vue'

const race = useRaceStore()

const PODIUM_SIZE = 3

// Newest round on top, with each finisher's horse and display time resolved once.
const rounds = computed(() =>
  race.results
    .map((result) => {
      const winnerTime = result.placings[0]!.time
      return {
        ...result,
        finishers: result.placings.map((placing, index) => ({
          place: index + 1,
          horse: race.horsesById.get(placing.horseId)!,
          time: index === 0 ? formatRaceTime(placing.time) : formatGap(placing.time - winnerTime),
        })),
      }
    })
    .reverse(),
)

const announcement = computed(() => {
  const latest = rounds.value[0]
  if (!latest) return ''
  const winner = latest.finishers[0]!
  return `Round ${latest.roundNumber} finished. ${winner.horse.name} wins in ${winner.time}.`
})
</script>

<template>
  <section class="panel" aria-labelledby="results-title">
    <h2 id="results-title" class="panel__title">
      Results <small>{{ race.results.length }} of {{ ROUND_DISTANCES.length }}</small>
    </h2>
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    <p v-if="!rounds.length" class="panel__empty">Results land here as each round finishes.</p>
    <TransitionGroup tag="ol" name="result" class="scroll">
      <li v-for="round in rounds" :key="round.roundNumber" class="round">
        <h3 class="round-title">Round {{ round.roundNumber }} · {{ round.distance }}m</h3>
        <ol class="finishers">
          <li v-for="finisher in round.finishers.slice(0, PODIUM_SIZE)" :key="finisher.horse.id">
            <b>{{ finisher.place }}</b>
            <SilkIcon :horse="finisher.horse" :size="20" />
            <span>{{ finisher.horse.name }}</span>
            <em>{{ finisher.time }}</em>
          </li>
        </ol>
        <details>
          <summary>All {{ round.finishers.length }} finishers</summary>
          <ol class="finishers">
            <li v-for="finisher in round.finishers.slice(PODIUM_SIZE)" :key="finisher.horse.id">
              <b>{{ finisher.place }}</b>
              <SilkIcon :horse="finisher.horse" :size="20" />
              <span>{{ finisher.horse.name }}</span>
              <em>{{ finisher.time }}</em>
            </li>
          </ol>
        </details>
      </li>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.scroll {
  overflow: auto;
  min-height: 0;
}

.round {
  padding: 10px var(--space-4);
  border-top: 1px solid var(--bg-subtle);
}

.round-title {
  font-size: var(--text-sm);
  font-weight: 700;
  font-stretch: 105%;
}

.finishers {
  display: grid;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.finishers li {
  display: grid;
  grid-template-columns: 1.125rem 20px 1fr auto;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

b {
  font-stretch: var(--stretch-condensed);
}

em {
  font-style: normal;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

summary {
  width: fit-content;
  margin-top: 6px;
  font-size: var(--text-xs);
  color: var(--text-muted);
  cursor: pointer;
}

.result-enter-active {
  transition:
    opacity 400ms var(--ease-out),
    transform 400ms var(--ease-out);
}

.result-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
