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
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  box-shadow: var(--shadow-sm);
}

/* auto-fill keeps any field size (1–20 runners) on a tidy grid. */
.board {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-2);
  padding: var(--space-3);
}

li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  padding: 6px var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  font-weight: 600;
}

b {
  min-width: 1.25ch;
  color: var(--text-muted);
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leader {
  border-color: var(--border-strong);
  background: var(--bg-strong);
  color: var(--text-on-strong);
}

.leader b {
  color: inherit;
}

.overtake-move {
  transition: transform 250ms var(--ease-out);
}

.empty {
  padding: var(--space-4);
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
