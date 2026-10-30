<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { SPEED_OPTIONS } from '../domain/config'
import { useRaceStore } from '../stores/race'

const race = useRaceStore()

const startLabel = computed(
  () =>
    ({
      idle: 'Start',
      ready: 'Start',
      racing: 'Pause',
      paused: 'Resume',
      finished: 'Race again',
    })[race.status],
)

const shortcuts: Record<string, () => void> = {
  ' ': race.toggle,
  g: () => race.generate(),
  '1': () => race.setSpeed(1),
  '2': () => race.setSpeed(2),
  '4': () => race.setSpeed(4),
}

function onKeydown(event: KeyboardEvent) {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, select, dialog')) return
  // Space already activates a focused button; don't toggle twice.
  if (event.key === ' ' && target.closest('button, summary, a')) return
  const action = shortcuts[event.key.toLowerCase()]
  if (!action) return
  event.preventDefault()
  action()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="controls">
    <div class="speed" role="group" aria-label="Playback speed">
      <button
        v-for="option in SPEED_OPTIONS"
        :key="option"
        type="button"
        :aria-pressed="race.speed === option"
        @click="race.setSpeed(option)"
      >
        {{ option }}×
      </button>
    </div>
    <button type="button" class="btn" aria-keyshortcuts="G" @click="race.generate()">
      Generate program
    </button>
    <button
      type="button"
      class="btn btn--primary start"
      aria-keyshortcuts="Space"
      @click="race.toggle()"
    >
      <svg
        v-if="race.status === 'racing'"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        aria-hidden="true"
      >
        <rect x="2" y="1" width="3" height="10" rx="1" fill="currentColor" />
        <rect x="7" y="1" width="3" height="10" rx="1" fill="currentColor" />
      </svg>
      <svg v-else width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2.5 1.5 L10.5 6 L2.5 10.5Z" fill="currentColor" stroke-linejoin="round" />
      </svg>
      {{ startLabel }}
    </button>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.speed {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
}

.speed button {
  min-width: 40px;
  height: 32px;
  border: 0;
  border-radius: var(--radius-pill);
  background: none;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
}

.speed button:hover {
  color: var(--text);
}

.speed button[aria-pressed='true'] {
  background: var(--bg-strong);
  color: var(--text-on-strong);
}

.start {
  min-width: 8.5rem;
}

@media (max-width: 640px) {
  .controls {
    width: 100%;
  }

  .controls > .btn {
    flex: 1 1 40%;
    min-width: 0;
  }
}
</style>
