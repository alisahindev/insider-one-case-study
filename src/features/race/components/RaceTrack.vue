<script setup lang="ts">
import { computed } from 'vue'
import { useRaceStore } from '../stores/race'
import { useSettingsStore } from '../stores/settings'
import { pluralize } from '../utils/format'
import RunnerFigure from './RunnerFigure.vue'

const race = useRaceStore()
const setup = useSettingsStore()

const distance = computed(() => race.currentRound?.distance ?? 0)
const laneCount = computed(() => race.settings.horsesPerRound)

/** One lane per entrant in gate order, with track position (0–1) and finishing place. */
const lanes = computed(() => {
  const standings = new Map(
    race.standings.map((s, index) => [s.horseId, { ...s, place: index + 1 }]),
  )
  return (race.currentRound?.horseIds ?? []).map((horseId, index) => {
    const standing = standings.get(horseId)
    return {
      horse: race.horsesById.get(horseId)!,
      gate: index + 1,
      progress: standing ? standing.distance / distance.value : 0,
      place: standing?.finished ? standing.place : null,
    }
  })
})

/** Poles counting down to the finish every 400m, like a real course. */
const poles = computed(() => {
  const marks = []
  for (let toGo = 400; toGo < distance.value; toGo += 400) {
    marks.push({ toGo, position: 1 - toGo / distance.value })
  }
  return marks
})

// In 50m steps, so the chip's text (and the layout it costs) changes a few times a second, not every frame.
const toGo = computed(() => {
  const leader = race.standings[0]
  if (!leader) return null
  return leader.finished
    ? 'Finish'
    : `${Math.ceil((distance.value - leader.distance) / 50) * 50}m to go`
})

const isLive = computed(() => race.status === 'racing' || race.status === 'paused')

function poseOf(place: number | null) {
  if (place || !isLive.value || race.countdown > 0) return 'stand'
  return race.status === 'racing' ? 'gallop' : 'hold'
}

// Notice copy, phrased for a single round or horse as well as the default day.
const summary = computed(() => {
  const { horseCount, horsesPerRound, distances } = race.settings
  const [first, last] = [distances[0], distances[distances.length - 1]]
  const single = distances.length === 1
  return {
    draw: `Draw ${horsesPerRound} of your ${horseCount} ${pluralize(horseCount, 'horse')} for ${
      single ? 'the one round' : `each of the ${distances.length} rounds`
    }.`,
    lineup: single
      ? `One round of ${first}m.`
      : `${distances.length} rounds from ${first}m to ${last}m, run back to back.`,
  }
})
</script>

<template>
  <div class="track" :style="{ '--lanes': Math.max(laneCount, 1), '--speed': race.speed }">
    <div class="course" aria-hidden="true">
      <div v-for="pole in poles" :key="pole.toGo" class="pole" :style="{ '--at': pole.position }">
        <span>{{ pole.toGo }}m</span>
      </div>
      <div class="finish-post" />
      <ol class="lanes">
        <li v-for="lane in lanes" :key="lane.horse.id" class="lane">
          <span class="gate">{{ lane.gate }}</span>
          <div class="run" :style="{ '--coat': lane.horse.color.hex }">
            <span class="trail" :style="{ '--progress': lane.progress }" />
            <div class="runner" :style="{ '--progress': lane.progress }">
              <RunnerFigure :horse="lane.horse" :pose="poseOf(lane.place)" />
              <span class="tag" :class="{ winner: lane.place === 1 }">
                <template v-if="lane.place">{{ lane.place }}. </template>{{ lane.horse.name }}
              </span>
            </div>
          </div>
        </li>
      </ol>
    </div>

    <p v-if="isLive && race.countdown === 0 && toGo" class="chip to-go">{{ toGo }}</p>
    <p v-if="race.status === 'paused'" class="chip paused">Paused</p>

    <Transition name="pop" mode="out-in">
      <p
        v-if="race.status === 'racing' && race.countdown > 0"
        :key="Math.ceil(race.countdown)"
        class="countdown"
      >
        {{ Math.ceil(race.countdown) }}
      </p>
      <div v-else-if="race.status === 'idle'" class="notice">
        <h3>Set the field</h3>
        <p>{{ summary.draw }}</p>
        <div class="notice__actions">
          <button type="button" class="btn btn--primary" @click="race.generate()">
            Generate program
          </button>
          <button type="button" class="btn" @click="setup.isSetupOpen = true">Race settings</button>
        </div>
      </div>
      <div v-else-if="race.status === 'ready'" class="notice">
        <h3>Round 1 is at the gate</h3>
        <p>{{ summary.lineup }}</p>
        <div class="notice__actions">
          <button type="button" class="btn btn--primary" @click="race.start()">
            Start the races
          </button>
          <button type="button" class="btn" @click="setup.isSetupOpen = true">Race settings</button>
        </div>
      </div>
      <div v-else-if="race.status === 'finished'" class="notice">
        <h3>Race day complete</h3>
        <p>Every result is in. Run a new program with the same stable.</p>
        <button type="button" class="btn btn--primary" @click="race.start()">Race again</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.track {
  --gate-width: 36px;
  --runoff: clamp(80px, 9vw, 120px);
  /* Horses scale with lane height, so 1 lane or 20 lanes both fit. */
  --figure-width: clamp(34px, calc((100cqh - 16px) / var(--lanes) * 1.35), 96px);

  position: relative;
  container-type: size;
  min-height: calc(var(--lanes) * 30px + 16px);
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: repeating-linear-gradient(
    90deg,
    var(--color-turf) 0 72px,
    var(--color-turf-stripe) 72px 144px
  );
  color: var(--color-rail);
}

.course {
  position: absolute;
  inset: 0;
  display: flex;
  padding: var(--space-2) 0;
}

/* The finish line sits where the runoff starts; poles share the same span. */
.pole,
.finish-post {
  position: absolute;
  top: 0;
  bottom: 0;
}

.pole {
  left: calc(
    var(--gate-width) + var(--figure-width) +
      (100% - var(--gate-width) - var(--figure-width) - var(--runoff)) * var(--at)
  );
  width: 1px;
  background: rgb(255 255 255 / 0.35);
}

.pole span {
  position: absolute;
  top: 6px;
  left: 6px;
  font-size: var(--text-xs);
  font-weight: 600;
  opacity: 0.85;
}

.finish-post {
  right: calc(var(--runoff) - 8px);
  width: 8px;
  background: repeating-linear-gradient(0deg, #ffffff 0 8px, var(--color-ink) 8px 16px);
}

.lanes {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.lane {
  display: flex;
  flex: 1;
  border-bottom: 1px dashed rgb(255 255 255 / 0.2);
}

.lane:last-child {
  border-bottom: 0;
}

.gate {
  display: grid;
  place-items: center;
  width: var(--gate-width);
  border-right: 2px solid #ffffff;
  background: rgb(0 0 0 / 0.12);
  font-size: var(--text-xs);
  font-weight: 700;
}

.run {
  position: relative;
  flex: 1;
  margin-left: var(--figure-width);
  margin-right: var(--runoff);
}

/*
 * Movement uses transforms only, so each frame skips layout and paint.
 * --progress is not inherited and set on the two elements that read it,
 * so a frame restyles those two instead of every element inside the runner.
 */
@property --progress {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

.trail {
  position: absolute;
  top: 60%;
  left: 0;
  width: 100%;
  height: 3px;
  transform: scaleX(var(--progress));
  transform-origin: left;
  background: linear-gradient(90deg, transparent, var(--coat));
  opacity: 0.55;
}

.runner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  transform: translateX(calc(var(--progress) * 100%));
  will-change: transform;
}

/* Name pins, styled like Airbnb's map price markers. */
.tag {
  margin-left: 6px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  background: #ffffff;
  box-shadow: var(--shadow-sm);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-ink);
  white-space: nowrap;
}

.tag.winner {
  background: var(--color-ink);
  color: #ffffff;
}

.chip {
  position: absolute;
  top: var(--space-3);
  padding: 6px var(--space-3);
  border-radius: var(--radius-pill);
  background: #ffffff;
  box-shadow: var(--shadow-md);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-ink);
}

.to-go {
  right: var(--space-3);
}

.paused {
  left: calc(var(--gate-width) + var(--space-3));
}

.countdown,
.notice {
  position: absolute;
  inset: 0;
  margin: auto;
}

.countdown {
  width: fit-content;
  height: fit-content;
  font-size: clamp(4rem, 10vw, 7rem);
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 4px 24px rgb(0 0 0 / 0.3);
}

.notice {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  width: min(380px, calc(100% - 2 * var(--space-4)));
  height: fit-content;
  padding: var(--space-5);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  box-shadow: var(--shadow-lg);
  color: var(--text);
}

.notice h3 {
  font-size: var(--text-xl);
  font-weight: 600;
}

.notice p {
  margin-bottom: var(--space-2);
  color: var(--text-muted);
}

.notice__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.pop-enter-active,
.pop-leave-active {
  transition:
    opacity var(--duration) var(--ease-out),
    transform var(--duration) var(--ease-out);
}

.pop-enter-from {
  opacity: 0;
  transform: scale(1.3);
}

.pop-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

@media (max-width: 640px) {
  .track {
    min-height: calc(var(--lanes) * 40px + 16px);
  }

  .pole span {
    display: none;
  }
}
</style>
