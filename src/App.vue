<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import logo from './assets/logo.svg'
import { useLayoutStore, type Column, type PanelId } from './features/layout/stores/layout'
import TourOverlay from './features/onboarding/components/TourOverlay.vue'
import { useTourStore } from './features/onboarding/stores/tour'
import HorseList from './features/race/components/HorseList.vue'
import LiveStandings from './features/race/components/LiveStandings.vue'
import ProgramPanel from './features/race/components/ProgramPanel.vue'
import RaceControls from './features/race/components/RaceControls.vue'
import RaceHeader from './features/race/components/RaceHeader.vue'
import RaceTrack from './features/race/components/RaceTrack.vue'
import ResultsPanel from './features/race/components/ResultsPanel.vue'
import SetupDialog from './features/race/components/SetupDialog.vue'
import SetupSummary from './features/race/components/SetupSummary.vue'
import { useRaceLoop } from './features/race/composables/useRaceLoop'

useRaceLoop()
const layout = useLayoutStore()
const tour = useTourStore()

// Panel registry: the layout store only knows ids; this maps them to components.
const PANEL_COMPONENTS: Record<PanelId, typeof HorseList> = {
  stable: HorseList,
  program: ProgramPanel,
  results: ResultsPanel,
}
const COLUMNS: Column[] = ['left', 'right']
</script>

<template>
  <div class="app">
    <header class="app-header">
      <div class="brand">
        <img :src="logo" alt="" width="48" height="36" />
        <!-- "1" stands for One; the label reads it out the way it is meant. -->
        <h1 aria-label="Insider One"><span class="one">1</span>nsider</h1>
      </div>
      <SetupSummary class="summary" data-tour="setup" />
      <RaceControls class="controls" data-tour="controls" />
      <button
        type="button"
        class="icon-btn tour-btn"
        aria-label="Take the tour"
        title="Take the tour"
        @click="tour.start()"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M6.5 6.75a2.5 2.5 0 1 1 3.6 2.25c-.7.33-1.1.9-1.1 1.6v.4"
            stroke="currentColor"
            stroke-width="1.8"
            fill="none"
            stroke-linecap="round"
          />
          <circle cx="9" cy="13.75" r="1.1" fill="currentColor" />
        </svg>
      </button>
    </header>

    <main class="app-main">
      <!-- Focusable because it can scroll (big fields on short screens). -->
      <section class="race" aria-label="Race" tabindex="0">
        <RaceHeader />
        <RaceTrack data-tour="track" />
        <LiveStandings data-tour="standings" />
      </section>

      <VueDraggable
        v-for="column in COLUMNS"
        :key="column"
        v-model="layout.columns[column]"
        :class="['column', `column--${column}`, { 'is-empty': !layout.columns[column].length }]"
        group="panels"
        handle=".handle"
        ghost-class="panel-ghost"
        fallback-class="panel-drag"
        :force-fallback="true"
        :animation="200"
        data-empty-label="Drop a panel here"
      >
        <component
          :is="PANEL_COMPONENTS[id]"
          v-for="id in layout.columns[column]"
          :key="id"
          :data-tour="id"
        />
      </VueDraggable>
    </main>

    <footer v-if="!layout.isDefault" class="app-footer">
      <button type="button" class="btn btn--ghost" @click="layout.reset()">Reset layout</button>
    </footer>

    <p id="layout-help" class="sr-only">
      Drag to move the panel, or use the arrow keys to move it between columns.
    </p>
    <p class="sr-only" aria-live="polite">{{ layout.announcement }}</p>
    <SetupDialog />
    <TourOverlay />
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100dvh;
}

.app-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-soft);
}

.summary {
  margin-inline: auto;
}

.tour-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.brand h1 {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
}

/* Inline, so the 1 shares the word's baseline. */
.one {
  color: var(--color-rausch);
}

.app-main {
  display: grid;
  grid-template-areas: 'race' 'right' 'left';
  gap: var(--space-5);
  padding: var(--space-5);
}

.race {
  grid-area: race;
  display: grid;
  grid-template-rows: auto minmax(360px, 1fr) auto;
  gap: var(--space-4);
  min-height: 0;
}

.column {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 0;
}

.column--left {
  grid-area: left;
}

.column--right {
  grid-area: right;
}

/* An empty column stays visible as a drop target. */
.column.is-empty {
  min-height: 160px;
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
}

.column.is-empty::after {
  content: attr(data-empty-label);
  margin: auto;
  color: var(--text-muted);
}

.app-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--border-soft);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.app-footer .btn {
  min-height: 0;
  padding: 0;
  font-size: var(--text-xs);
}

@media (max-width: 1199px) {
  .app-header {
    display: grid;
    grid-template-columns: auto 1fr auto;
  }

  .controls {
    justify-self: end;
  }

  .summary {
    grid-row: 2;
    grid-column: 1 / -1;
    justify-self: center;
  }
}

@media (max-width: 640px) {
  .app-header {
    grid-template-columns: 1fr auto;
    padding: var(--space-3) var(--space-4);
  }

  /* Phones: the tour button sits on the brand row, controls get a full row. */
  .tour-btn {
    grid-area: 1 / 2;
  }

  .summary {
    grid-row: auto;
  }

  .controls {
    grid-column: 1 / -1;
  }

  .app-main {
    gap: var(--space-4);
    padding: var(--space-4);
  }
}

/* Tablet: race on top, side columns below it. */
@media (min-width: 768px) {
  .app-main {
    grid-template-columns: 1fr 1fr;
    grid-template-areas: 'race race' 'left right';
  }

  .race {
    grid-template-rows: auto minmax(460px, 1fr) auto;
  }
}

/* Desktop: one screen, track in the middle, side panels scroll on their own. */
@media (min-width: 1200px) and (min-height: 720px) {
  .app {
    height: 100dvh;
  }

  .app-main {
    grid-template-columns: 300px minmax(0, 1fr) 340px;
    grid-template-areas: 'left race right';
    min-height: 0;
  }

  /* The track keeps its minimum lane height; a big field or a short screen scrolls the middle column. */
  .race {
    grid-template-rows: auto 1fr auto;
    overflow-y: auto;
  }

  .column > :deep(.panel) {
    flex: 1 1 0;
  }
}
</style>
