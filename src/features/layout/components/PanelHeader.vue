<script setup lang="ts">
import { useLayoutStore, PANELS, type Direction, type PanelId } from '../stores/layout'

const { panelId } = defineProps<{ panelId: PanelId }>()
const layout = useLayoutStore()

const KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

function onKeydown(event: KeyboardEvent) {
  const direction = KEYS[event.key]
  if (!direction) return
  event.preventDefault()
  layout.move(panelId, direction)
  // The panel re-mounts in its new spot; keep focus on its handle.
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>(`[data-handle="${panelId}"]`)?.focus(),
  )
}
</script>

<template>
  <header class="panel__header">
    <button
      type="button"
      class="handle"
      :data-handle="panelId"
      :aria-label="`Move ${PANELS[panelId]} panel`"
      aria-describedby="layout-help"
      @keydown="onKeydown"
    >
      <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true">
        <g fill="currentColor">
          <circle cx="3" cy="3" r="1.5" />
          <circle cx="9" cy="3" r="1.5" />
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="9" cy="8" r="1.5" />
          <circle cx="3" cy="13" r="1.5" />
          <circle cx="9" cy="13" r="1.5" />
        </g>
      </svg>
    </button>
    <h2 :id="`${panelId}-title`" class="panel__title">{{ PANELS[panelId] }}</h2>
    <span class="panel__meta"><slot /></span>
  </header>
</template>

<style scoped>
.handle {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-left: -6px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-muted);
  cursor: grab;
  touch-action: none;
}

.handle:hover {
  background: var(--bg-subtle);
  color: var(--text);
}

.handle:active {
  cursor: grabbing;
}
</style>
