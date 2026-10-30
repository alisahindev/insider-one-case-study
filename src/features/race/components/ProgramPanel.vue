<script setup lang="ts">
import PanelHeader from '@/features/layout/components/PanelHeader.vue'
import { useRaceStore } from '../stores/race'
import SilkIcon from './SilkIcon.vue'

const race = useRaceStore()

const STATUS_LABEL = { done: 'Finished', live: 'Live', upcoming: 'Up next' } as const
</script>

<template>
  <section class="panel" aria-labelledby="program-title">
    <PanelHeader panel-id="program">{{ race.roundCount }} rounds</PanelHeader>
    <p v-if="!race.schedule.length" class="panel__empty">
      Generate a program to draw {{ race.settings.horsesPerRound }} horses for each round.
    </p>
    <ol v-else class="panel__body rounds">
      <li v-for="round in race.schedule" :key="round.number">
        <details>
          <summary>
            <span class="round-title">Round {{ round.number }} · {{ round.distance }}m</span>
            <span class="chip" :class="race.roundState(round.number)">
              {{ STATUS_LABEL[race.roundState(round.number)] }}
            </span>
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
  border-top: 1px solid var(--border-soft);
}

summary {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
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
  font-weight: 600;
}

.chip {
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
}

.chip.live {
  background: var(--primary);
  color: #ffffff;
}

.chip.done {
  background: var(--bg-subtle);
  color: var(--text);
}

.silks {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.entrants {
  display: grid;
  gap: 6px;
  padding: 0 var(--space-4) var(--space-3);
}

.entrants li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.gate {
  width: 1.25rem;
  font-weight: 600;
  color: var(--text-muted);
}
</style>
