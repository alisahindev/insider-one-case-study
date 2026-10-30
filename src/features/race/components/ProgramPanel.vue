<script setup lang="ts">
import { useRaceStore } from '../stores/race'
import SilkIcon from './SilkIcon.vue'

const race = useRaceStore()

const STATUS_LABEL = { done: 'Finished', live: 'Live', upcoming: 'Up next' } as const
</script>

<template>
  <section class="panel" aria-labelledby="program-title">
    <h2 id="program-title" class="panel__title">
      Program <small>{{ race.schedule.length || 6 }} rounds</small>
    </h2>
    <p v-if="!race.schedule.length" class="panel__empty">
      Generate a program to draw 10 horses for each round.
    </p>
    <ol v-else class="rounds">
      <li v-for="round in race.schedule" :key="round.number">
        <details>
          <summary>
            <span class="round-title">Round {{ round.number }} · {{ round.distance }}m</span>
            <span class="chip" :class="race.roundState(round.number)">{{
              STATUS_LABEL[race.roundState(round.number)]
            }}</span>
            <span class="silks" aria-hidden="true">
              <SilkIcon
                v-for="id in round.horseIds"
                :key="id"
                :horse="race.horsesById.get(id)!"
                :size="18"
              />
            </span>
          </summary>
          <ol class="entrants">
            <li v-for="(id, index) in round.horseIds" :key="id">
              <span class="gate">{{ index + 1 }}</span>
              <SilkIcon :horse="race.horsesById.get(id)!" :size="18" />
              {{ race.horsesById.get(id)!.name }}
            </li>
          </ol>
        </details>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.rounds > li {
  border-top: 1px solid var(--bg-subtle);
}

summary {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-2);
  padding: 10px var(--space-4);
  list-style: none;
  cursor: pointer;
}

summary::-webkit-details-marker {
  display: none;
}

summary:hover {
  background: var(--bg-subtle);
}

.round-title {
  font-size: var(--text-sm);
  font-weight: 700;
  font-stretch: 105%;
}

.chip {
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--bg-subtle);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
}

.chip.live {
  background: var(--color-brass);
  color: var(--color-board);
}

.chip.done {
  background: var(--accent);
  color: var(--bg-surface);
}

.silks {
  grid-column: 1 / -1;
  display: flex;
  gap: 3px;
}

.entrants {
  display: grid;
  gap: var(--space-1);
  padding: 0 var(--space-4) var(--space-3);
  font-size: var(--text-sm);
}

.entrants li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.gate {
  width: 1.25rem;
  font-weight: 700;
  font-stretch: var(--stretch-condensed);
  color: var(--text-muted);
}
</style>
