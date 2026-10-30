<script setup lang="ts">
import { computed } from 'vue'
import { useRaceStore } from '../stores/race'
import SilkIcon from './SilkIcon.vue'

const race = useRaceStore()
const runningIds = computed(() => new Set(race.currentRound?.horseIds))
const hasLiveRound = computed(() => race.status === 'racing' || race.status === 'paused')
</script>

<template>
  <section class="panel" aria-labelledby="stable-title">
    <h2 id="stable-title" class="panel__title">
      Stable <small>{{ race.horses.length }} horses</small>
    </h2>
    <div class="scroll">
      <table class="horses">
        <thead>
          <tr>
            <th scope="col">Horse</th>
            <th scope="col">Condition</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="horse in race.horses"
            :key="horse.id"
            :class="{ resting: hasLiveRound && !runningIds.has(horse.id) }"
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
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.scroll {
  overflow: auto;
  min-height: 0;
}

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
  border-top: 1px solid var(--bg-subtle);
}

tr {
  transition: opacity var(--duration) var(--ease-out);
}

tr.resting {
  opacity: 0.45;
}

.horse {
  display: flex;
  align-items: center;
  gap: 10px;
}

.name {
  font-weight: 600;
  font-stretch: 90%;
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
  background: var(--bg-subtle);
}

meter::-webkit-meter-bar {
  border: 0;
  border-radius: 2px;
  background: var(--bg-subtle);
}

meter::-webkit-meter-optimum-value {
  border-radius: 2px;
  background: var(--accent);
}

meter::-moz-meter-bar {
  border-radius: 2px;
  background: var(--accent);
}
</style>
