<script setup lang="ts">
import { computed } from 'vue'
import PanelHeader from '@/features/layout/components/PanelHeader.vue'
import { useRaceStore } from '../stores/race'
import { pluralize } from '../utils/format'
import SilkIcon from './SilkIcon.vue'

const race = useRaceStore()
// The round at the gate or running; none before a program or after the last round.
const field = computed(() =>
  race.status === 'idle' || race.status === 'finished'
    ? null
    : new Set(race.currentRound?.horseIds),
)
// Runners first. Sort is stable, so each group keeps stable-number order.
const rows = computed(() => {
  const ids = field.value
  return ids ? [...race.horses].sort((a, b) => +ids.has(b.id) - +ids.has(a.id)) : race.horses
})
</script>

<template>
  <section class="panel" aria-labelledby="stable-title">
    <PanelHeader panel-id="stable">
      {{ race.horses.length }} {{ pluralize(race.horses.length, 'horse') }}
    </PanelHeader>
    <!-- Focusable so keyboard users can scroll the list too. -->
    <div class="panel__body" tabindex="0" aria-labelledby="stable-title">
      <table class="horses">
        <thead>
          <tr>
            <th scope="col">Horse</th>
            <th scope="col">Condition</th>
          </tr>
        </thead>
        <TransitionGroup tag="tbody" name="reorder">
          <tr
            v-for="horse in rows"
            :key="horse.id"
            :class="{ resting: field && !field.has(horse.id) }"
          >
            <td>
              <div class="horse">
                <SilkIcon :horse="horse" :size="28" />
                <div>
                  <div class="name">{{ horse.name }}</div>
                  <div class="meta">No. {{ horse.id }} · {{ horse.color.name }}</div>
                </div>
              </div>
            </td>
            <td>
              <div class="condition">
                <meter
                  :value="horse.condition"
                  min="1"
                  max="100"
                  :aria-label="`${horse.name} condition`"
                >
                  {{ horse.condition }}
                </meter>
                <span aria-hidden="true">{{ horse.condition }}</span>
              </div>
            </td>
          </tr>
        </TransitionGroup>
      </table>
    </div>
  </section>
</template>

<style scoped>
.horses {
  width: 100%;
  border-collapse: collapse;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: var(--space-2) var(--space-4);
  background: var(--bg-surface);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  text-align: left;
}

td {
  padding: 7px var(--space-4);
  border-top: 1px solid var(--border-soft);
}

.reorder-move {
  transition: transform 300ms var(--ease-out);
}

/* Resting horses fade their silk and soften their text, but text stays above AA contrast. */
.resting {
  color: var(--text-muted);
}

.resting :deep(.silk),
.resting meter {
  opacity: 0.4;
}

.horse {
  display: flex;
  align-items: center;
  gap: 10px;
}

.name {
  font-weight: 600;
}

.meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.condition {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-sm);
  font-weight: 600;
}

meter {
  width: 40px;
  height: 4px;
  appearance: none;
  border-radius: 2px;
  background: var(--border-soft);
}

meter::-webkit-meter-bar {
  border: 0;
  border-radius: 2px;
  background: var(--border-soft);
}

meter::-webkit-meter-optimum-value {
  border-radius: 2px;
  background: var(--text);
}

meter::-moz-meter-bar {
  border-radius: 2px;
  background: var(--text);
}
</style>
