<script setup lang="ts">
import { computed } from 'vue'
import { useRaceStore } from '../stores/race'
import SilkIcon from './SilkIcon.vue'

const race = useRaceStore()

// Standings change every frame but the order rarely does. A string computed only
// notifies dependents when its value changes, so this list re-renders on overtakes only.
const orderKey = computed(() => race.standings.map((s) => s.horseId).join(','))
const order = computed(() =>
  orderKey.value ? orderKey.value.split(',').map((id) => race.horsesById.get(Number(id))!) : [],
)
</script>

<template>
  <section class="standings" aria-label="Live standings">
    <TransitionGroup v-if="order.length" tag="ol" name="overtake" class="board">
      <li v-for="(horse, index) in order" :key="horse.id" :class="{ leader: index === 0 }">
        <b>{{ index + 1 }}</b>
        <SilkIcon :horse="horse" :size="16" />
        <span class="name">{{ horse.name }}</span>
      </li>
    </TransitionGroup>
    <p v-else class="empty">Live standings appear here once a round is drawn.</p>
  </section>
</template>

<style scoped>
.standings {
  border-radius: var(--radius-md);
  background: var(--color-board);
  color: var(--color-rail);
}

.board {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 2px;
  padding: 6px;
}

li {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 6px var(--space-2);
  border-radius: 5px;
  background: var(--color-board-raised);
  font-size: var(--text-sm);
  font-weight: 600;
  font-stretch: 85%;
}

b {
  font-stretch: var(--stretch-condensed);
  color: var(--color-brass);
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leader {
  background: var(--color-brass);
  color: var(--color-board);
}

.leader b {
  color: inherit;
}

.overtake-move {
  transition: transform 400ms var(--ease-out);
}

.empty {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  color: rgb(247 247 242 / 0.7);
}

@media (max-width: 640px) {
  .board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
