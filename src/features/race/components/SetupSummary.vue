<script setup lang="ts">
import { useRaceStore } from '../stores/race'
import { useSettingsStore } from '../stores/settings'

const race = useRaceStore()
const setup = useSettingsStore()
</script>

<template>
  <!-- Echoes Airbnb's search pill: the race day at a glance, one click to change it. -->
  <button type="button" class="summary" @click="setup.isSetupOpen = true">
    <span class="part"
      ><b>{{ race.settings.horseCount }}</b> horses</span
    >
    <span class="part"
      ><b>{{ race.settings.distances.length }}</b> rounds</span
    >
    <span class="part"
      ><b>{{ race.settings.horsesPerRound }}</b> per round</span
    >
    <span class="action" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 16 16">
        <path
          d="M2 4h7M13 4h1M2 12h1M7 12h7M11 2v4M5 10v4"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </span>
    <span class="sr-only">, change race day settings</span>
  </button>
</template>

<style scoped>
.summary {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 var(--space-2) 0 var(--space-5);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--bg-surface);
  box-shadow:
    0 1px 2px rgb(0 0 0 / 0.08),
    0 4px 12px rgb(0 0 0 / 0.05);
  cursor: pointer;
  transition: box-shadow var(--duration) var(--ease-out);
}

.summary:hover {
  box-shadow: var(--shadow-md);
}

.part {
  padding: 0 var(--space-4);
  border-left: 1px solid var(--border);
  white-space: nowrap;
}

.part:first-child {
  padding-left: 0;
  border-left: 0;
}

.part b {
  font-weight: 600;
}

.action {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-rausch);
  color: #ffffff;
}

@media (max-width: 640px) {
  .summary {
    width: 100%;
    justify-content: space-between;
    padding-left: var(--space-4);
  }

  .part {
    padding: 0 var(--space-2);
  }
}
</style>
