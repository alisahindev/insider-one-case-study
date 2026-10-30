<script setup lang="ts">
import { computed } from 'vue'
import PanelHeader from '@/features/layout/components/PanelHeader.vue'
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
    <PanelHeader panel-id="results">{{ race.results.length }} of {{ race.roundCount }}</PanelHeader>
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    <p v-if="!rounds.length" class="panel__empty">Results land here as each round finishes.</p>
    <TransitionGroup tag="ol" name="result" class="panel__body">
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
        <details v-if="round.finishers.length > PODIUM_SIZE">
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
.round {
  padding: var(--space-3) var(--space-4) var(--space-4);
  border-top: 1px solid var(--border-soft);
}

.round-title {
  font-size: var(--text-sm);
  font-weight: 600;
}

.finishers {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.finishers li {
  display: grid;
  grid-template-columns: 1.125rem 20px 1fr auto;
  align-items: center;
  gap: var(--space-2);
}

b {
  font-weight: 600;
}

em {
  font-style: normal;
  color: var(--text-muted);
}

summary {
  width: fit-content;
  margin-top: var(--space-2);
  font-weight: 600;
  text-decoration: underline;
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
