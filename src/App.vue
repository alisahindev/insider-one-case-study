<script setup lang="ts">
import HorseList from './features/race/components/HorseList.vue'
import LiveStandings from './features/race/components/LiveStandings.vue'
import ProgramPanel from './features/race/components/ProgramPanel.vue'
import RaceControls from './features/race/components/RaceControls.vue'
import RaceHeader from './features/race/components/RaceHeader.vue'
import RaceTrack from './features/race/components/RaceTrack.vue'
import ResultsPanel from './features/race/components/ResultsPanel.vue'
import { useRaceLoop } from './features/race/composables/useRaceLoop'

useRaceLoop()
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1 class="wordmark">
        <img src="/favicon.svg" alt="" width="28" height="28" />
        Furlong
      </h1>
      <RaceControls />
    </header>
    <main class="app-main">
      <section class="race" aria-label="Race">
        <RaceHeader />
        <RaceTrack />
        <LiveStandings />
      </section>
      <HorseList class="stable" />
      <div class="card">
        <ProgramPanel />
        <ResultsPanel />
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: var(--space-4);
  min-height: 100dvh;
  padding: var(--space-4);
}

.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-4);
}

.wordmark {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.375rem;
  font-weight: 800;
  font-stretch: var(--stretch-wide);
  letter-spacing: -0.01em;
}

.app-main {
  display: grid;
  grid-template-areas: 'race' 'card' 'stable';
  gap: var(--space-4);
}

.race {
  grid-area: race;
  display: grid;
  grid-template-rows: auto minmax(360px, 1fr) auto;
  gap: var(--space-3);
  min-height: 0;
}

.stable {
  grid-area: stable;
}

.card {
  grid-area: card;
  display: grid;
  gap: var(--space-4);
  align-content: start;
}

/* Tablet: race on top, stable and race card side by side. */
@media (min-width: 768px) {
  .app-main {
    grid-template-columns: 1fr 1fr;
    grid-template-areas: 'race race' 'stable card';
  }

  .race {
    grid-template-rows: auto minmax(460px, 1fr) auto;
  }
}

/* Desktop: everything fits one screen; side panels scroll on their own. */
@media (min-width: 1200px) and (min-height: 720px) {
  .app {
    height: 100dvh;
  }

  .app-main {
    grid-template-columns: 272px minmax(0, 1fr) 320px;
    grid-template-areas: 'stable race card';
    min-height: 0;
  }

  .race {
    grid-template-rows: auto minmax(0, 1fr) auto;
  }

  .stable,
  .card {
    min-height: 0;
  }

  .card {
    grid-template-rows: auto minmax(0, 1fr);
  }

  .card > :deep(.panel) {
    min-height: 0;
  }
}
</style>
