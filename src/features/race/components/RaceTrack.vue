<script setup lang="ts">
import { computed } from 'vue'
import { useRaceStore } from '../stores/race'
import RunnerFigure from './RunnerFigure.vue'

const race = useRaceStore()

const distance = computed(() => race.currentRound?.distance ?? 0)

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

const toGo = computed(() => {
  const leader = race.standings[0]
  if (!leader) return null
  return leader.finished ? 'Finish' : `${Math.ceil(distance.value - leader.distance)}m to go`
})

const isRunning = computed(() => race.status === 'racing' && race.countdown === 0)
const isLive = computed(() => race.status === 'racing' || race.status === 'paused')
</script>

<template>
  <div class="track">
    <div class="course" aria-hidden="true">
      <div v-for="pole in poles" :key="pole.toGo" class="pole" :style="{ '--at': pole.position }">
        <span>{{ pole.toGo }}m</span>
      </div>
      <div class="finish-post" />
      <ol class="lanes">
        <li v-for="lane in lanes" :key="lane.horse.id" class="lane">
          <span class="gate">{{ lane.gate }}</span>
          <div class="run" :style="{ '--progress': lane.progress, '--silk': lane.horse.color.hex }">
            <span class="trail" />
            <div class="runner">
              <RunnerFigure
                :horse="lane.horse"
                :number="lane.gate"
                :running="isRunning && !lane.place"
              />
              <span class="tag" :class="{ winner: lane.place === 1 }">
                <template v-if="lane.place">{{ lane.place }}. </template>{{ lane.horse.name }}
              </span>
            </div>
          </div>
        </li>
      </ol>
    </div>

    <p v-if="isLive && race.countdown === 0 && toGo" class="to-go">{{ toGo }}</p>
    <p v-if="race.status === 'paused'" class="paused">Paused</p>

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
        <p>Draw 10 of the 20 horses for each of the six rounds.</p>
        <button type="button" class="btn btn--primary" @click="race.generate()">
          Generate program
        </button>
      </div>
      <div v-else-if="race.status === 'ready'" class="notice">
        <h3>Round 1 is at the gate</h3>
        <p>Six rounds from 1200m to 2200m, run back to back.</p>
        <button type="button" class="btn btn--primary" @click="race.start()">
          Start the races
        </button>
      </div>
      <div v-else-if="race.status === 'finished'" class="notice">
        <h3>Race day complete</h3>
        <p>All six results are in. Run a new program with the same stable.</p>
        <button type="button" class="btn btn--primary" @click="race.start()">Race again</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.track {
  --gate-width: 40px;
  --figure-width: clamp(52px, 6vw, 92px);
  --runoff: clamp(72px, 9vw, 120px);

  position: relative;
  display: grid;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: repeating-linear-gradient(
    90deg,
    var(--color-turf) 0 80px,
    var(--color-turf-stripe) 80px 160px
  );
  color: var(--color-rail);
}

.course {
  position: relative;
  display: flex;
  padding: var(--space-2) 0;
}

/* The finish line sits where the runoff starts; poles are placed along the same span. */
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
  width: 2px;
  background: rgb(247 247 242 / 0.3);
}

.pole span {
  position: absolute;
  top: 4px;
  left: 6px;
  font-size: var(--text-xs);
  font-weight: 700;
  font-stretch: var(--stretch-condensed);
  opacity: 0.75;
}

.finish-post {
  right: calc(var(--runoff) - 8px);
  width: 8px;
  background: repeating-linear-gradient(0deg, var(--color-rail) 0 8px, var(--color-board) 8px 16px);
}

.lanes {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.lane {
  display: flex;
  flex: 1;
  min-height: 34px;
  border-bottom: 1px dashed rgb(247 247 242 / 0.18);
}

.lane:last-child {
  border-bottom: 0;
}

.gate {
  display: grid;
  place-items: center;
  width: var(--gate-width);
  border-right: 2px solid var(--color-rail);
  background: rgb(0 0 0 / 0.18);
  font-weight: 800;
  font-stretch: var(--stretch-condensed);
}

.run {
  position: relative;
  flex: 1;
  margin-left: var(--figure-width);
  margin-right: var(--runoff);
}

/* Movement uses transforms only, so each frame skips layout and paint. */
.trail {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 3px;
  margin-top: -1.5px;
  transform: scaleX(var(--progress));
  transform-origin: left;
  background: linear-gradient(90deg, transparent, var(--silk));
  opacity: 0.6;
}

.runner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  transform: translateX(calc(var(--progress) * 100%));
  will-change: transform;
}

.runner :deep(.figure) {
  position: absolute;
  right: 100%;
}

.tag {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgb(20 33 26 / 0.6);
  font-size: var(--text-xs);
  font-weight: 700;
  font-stretch: var(--stretch-condensed);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .pole span {
    display: none;
  }
}

.tag.winner {
  background: var(--color-brass);
  color: var(--color-board);
}

.to-go,
.paused {
  position: absolute;
  top: var(--space-3);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-board);
  font-weight: 800;
  font-stretch: 110%;
  font-size: var(--text-sm);
}

.to-go {
  right: var(--space-3);
  color: var(--color-brass);
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
  font-size: clamp(4rem, 10vw, 8rem);
  font-weight: 800;
  font-stretch: var(--stretch-wide);
  line-height: 1;
  color: var(--color-brass);
  text-shadow: 0 4px 24px rgb(0 0 0 / 0.35);
}

.notice {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  width: min(360px, calc(100% - 2 * var(--space-4)));
  height: fit-content;
  padding: var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-board);
}

.notice h3 {
  font-size: 1.25rem;
  font-stretch: 110%;
}

.notice p {
  margin-bottom: var(--space-2);
  color: rgb(247 247 242 / 0.75);
}

.notice .btn--primary {
  border-color: var(--color-brass);
  background: var(--color-brass);
  color: var(--color-board);
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
</style>
