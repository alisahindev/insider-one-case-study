<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { SPEED_OPTIONS, useRaceStore } from '../stores/race'

const race = useRaceStore()

const startLabel = computed(
  () =>
    ({ idle: 'Start', ready: 'Start', racing: 'Pause', paused: 'Resume', finished: 'Race again' })[
      race.status
    ],
)

const linkCopied = ref(false)
async function copyShareLink() {
  const url = new URL(location.href)
  url.searchParams.set('seed', String(race.seed))
  try {
    await navigator.clipboard.writeText(url.href)
    linkCopied.value = true
    setTimeout(() => (linkCopied.value = false), 2000)
  } catch {
    // Clipboard is blocked outside secure contexts; let the user copy it by hand.
    window.prompt('Copy this link to share the race day', url.href)
  }
}

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
  if (target.closest('input, textarea, select')) return
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
    <button type="button" class="seed" @click="copyShareLink">
      <span aria-live="polite">{{ linkCopied ? 'Link copied' : `Race day #${race.seed}` }}</span>
      <span class="sr-only">, copy share link</span>
    </button>
    <div class="spacer" />
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
      Generate program <kbd aria-hidden="true">G</kbd>
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
        <rect x="2" y="1" width="3" height="10" fill="currentColor" />
        <rect x="7" y="1" width="3" height="10" fill="currentColor" />
      </svg>
      <svg v-else width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2 1 L11 6 L2 11Z" fill="currentColor" />
      </svg>
      {{ startLabel }} <kbd aria-hidden="true">Space</kbd>
    </button>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.spacer {
  flex: 1;
}

.seed {
  padding: var(--space-1) 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: none;
  font-size: var(--text-sm);
  color: var(--text-muted);
  cursor: pointer;
}

.speed {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
}

.speed button {
  padding: 9px var(--space-3);
  border: 0;
  background: none;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
}

.speed button[aria-pressed='true'] {
  background: var(--color-board);
  color: var(--color-rail);
}

.start {
  min-width: 9.5rem;
  justify-content: center;
}

kbd {
  padding: 0 var(--space-1);
  border: 1px solid currentColor;
  border-radius: 4px;
  font: inherit;
  font-size: var(--text-xs);
  opacity: 0.7;
}

/* Phones: controls get their own row under the wordmark, main actions split it evenly. */
@media (max-width: 640px) {
  .controls {
    flex-basis: 100%;
  }

  kbd,
  .spacer {
    display: none;
  }

  .seed {
    margin-right: auto;
  }

  .controls > .btn {
    flex: 1 1 40%;
    justify-content: center;
    min-width: 0;
  }
}
</style>
