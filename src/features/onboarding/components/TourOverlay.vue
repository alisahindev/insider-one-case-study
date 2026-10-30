<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, useTemplateRef, watch } from 'vue'
import { useRaceStore } from '@/features/race/stores/race'
import { TOUR_STEPS } from '../steps'
import { useTourStore } from '../stores/tour'

const PAD = 8 // room around the spotlit element
const GAP = 14 // between the spotlight and the card
const EDGE = 16 // the card keeps this far from the viewport edge
const MOVE_MS = 450 // also feeds the --tour-move CSS transition

interface Box {
  x: number
  y: number
  width: number
  height: number
}

const tour = useTourStore()
const race = useRaceStore()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const card = useTemplateRef<HTMLElement>('card')
const nextButton = useTemplateRef<HTMLButtonElement>('next')

// The step on screen. It outlives `tour.step` while the tour fades out.
const shown = ref(0)
const current = computed(() => TOUR_STEPS[shown.value]!)
const isFirst = computed(() => shown.value === 0)
const isLast = computed(() => shown.value === TOUR_STEPS.length - 1)
const announcement = computed(
  () =>
    `Step ${shown.value + 1} of ${TOUR_STEPS.length}. ${current.value.title}. ${current.value.body}`,
)

const hole = ref<Box>({ x: 0, y: 0, width: 0, height: 0 })
const holeRadius = ref(0)
const place = ref({ x: 0, y: 0 })
const isSheet = ref(false) // narrow screens dock the card to the bottom
const isMoving = ref(false) // transitions run only while gliding to a new step
const isLeaving = ref(false)

const targetOf = (index: number) => {
  const selector = TOUR_STEPS[index]?.target
  return selector ? document.querySelector<HTMLElement>(selector) : null
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Beside the target if there is room (below, above, right, left); inside its lower edge if not. */
function placeNear(r: Box, w: number, h: number, vw: number, vh: number) {
  const clampX = (x: number) => Math.min(Math.max(x, EDGE), vw - w - EDGE)
  const clampY = (y: number) => Math.min(Math.max(y, EDGE), vh - h - EDGE)
  const centreX = clampX(r.x + r.width / 2 - w / 2)
  const centreY = clampY(r.y + r.height / 2 - h / 2)
  if (r.y + r.height + GAP + h <= vh - EDGE) return { x: centreX, y: r.y + r.height + GAP }
  if (r.y - GAP - h >= EDGE) return { x: centreX, y: r.y - GAP - h }
  if (r.x + r.width + GAP + w <= vw - EDGE) return { x: r.x + r.width + GAP, y: centreY }
  if (r.x - GAP - w >= EDGE) return { x: r.x - GAP - w, y: centreY }
  return { x: centreX, y: clampY(r.y + r.height - h - EDGE) }
}

/** Reads the target and card, then moves the spotlight and card if anything changed. */
function layout() {
  const vw = innerWidth
  const vh = innerHeight
  const rect = targetOf(shown.value)?.getBoundingClientRect()
  const next: Box = rect
    ? {
        x: Math.round(rect.left - PAD),
        y: Math.round(rect.top - PAD),
        width: Math.round(rect.width + PAD * 2),
        height: Math.round(rect.height + PAD * 2),
      }
    : { x: Math.round(vw / 2), y: Math.round(vh / 2), width: 0, height: 0 }
  const w = card.value?.offsetWidth ?? 0
  const h = card.value?.offsetHeight ?? 0
  isSheet.value = vw < 640
  const pos = isSheet.value
    ? { x: EDGE, y: vh - h - EDGE }
    : rect
      ? placeNear(next, w, h, vw, vh)
      : { x: (vw - w) / 2, y: (vh - h) / 2 }
  const { x, y, width, height } = hole.value
  if (next.x !== x || next.y !== y || next.width !== width || next.height !== height) {
    hole.value = next
  }
  pos.x = Math.round(pos.x)
  pos.y = Math.round(pos.y)
  if (pos.x !== place.value.x || pos.y !== place.value.y) place.value = pos
}

// Follows the target through scrolling, resizing and content changes while the tour is open.
let frame = 0
function loop() {
  layout()
  frame = requestAnimationFrame(loop)
}

let moveTimer = 0
function glide() {
  isMoving.value = true
  clearTimeout(moveTimer)
  moveTimer = window.setTimeout(() => (isMoving.value = false), MOVE_MS)
}

/** Brings an off-screen target into view; on phones it goes near the top, above the docked card. */
function reveal(el: HTMLElement | null) {
  if (!el) return
  const r = el.getBoundingClientRect()
  const bottom = innerWidth < 640 ? innerHeight * 0.55 : innerHeight - EDGE
  if (r.top >= EDGE && r.bottom <= bottom) return
  const top = innerWidth < 640 ? r.top - 72 : r.top + r.height / 2 - innerHeight / 2
  window.scrollBy({ top, behavior: reducedMotion() ? 'auto' : 'smooth' })
}

async function open() {
  isLeaving.value = false
  if (race.status === 'racing') race.pause() // a tour shouldn't let a race run unwatched
  if (!dialog.value?.open) dialog.value?.showModal()
  await nextTick()
  layout() // first placement lands without a glide
  loop()
}

let leaveTimer = 0
function leave() {
  isLeaving.value = true
  cancelAnimationFrame(frame)
  leaveTimer = window.setTimeout(() => dialog.value?.close(), 200)
}

watch(
  () => tour.step,
  async (step, previous) => {
    if (step === null) return leave()
    clearTimeout(leaveTimer)
    const target = targetOf(step)
    holeRadius.value = target ? parseFloat(getComputedStyle(target).borderTopLeftRadius) + PAD : 0
    shown.value = step
    if (previous === null || previous === undefined || isLeaving.value) return open()
    glide()
    reveal(target)
    await nextTick()
    // Back from step 2 removes the focused Back button; keep focus inside the card.
    if (!card.value?.contains(document.activeElement)) nextButton.value?.focus()
  },
)

onScopeDispose(() => {
  cancelAnimationFrame(frame)
  clearTimeout(moveTimer)
  clearTimeout(leaveTimer)
})
</script>

<template>
  <dialog
    ref="dialog"
    class="tour"
    :class="{ 'is-moving': isMoving, 'is-leaving': isLeaving }"
    :style="{ '--tour-move': `${MOVE_MS}ms` }"
    aria-labelledby="tour-title"
    @cancel.prevent="tour.close()"
    @keydown.right.prevent="tour.next()"
    @keydown.left.prevent="tour.back()"
  >
    <div
      class="hole"
      aria-hidden="true"
      :style="{
        transform: `translate(${hole.x}px, ${hole.y}px)`,
        width: `${hole.width}px`,
        height: `${hole.height}px`,
        borderRadius: `${holeRadius}px`,
      }"
    />
    <section
      ref="card"
      class="card"
      :class="{ 'is-sheet': isSheet }"
      :style="{ transform: `translate(${place.x}px, ${place.y}px)` }"
    >
      <div class="card__top">
        <span class="count">{{ shown + 1 }} of {{ TOUR_STEPS.length }}</span>
        <button v-if="!isLast" type="button" class="skip" @click="tour.close()">Skip tour</button>
      </div>
      <Transition name="swap" mode="out-in">
        <div :key="shown" class="card__text">
          <h2 id="tour-title">{{ current.title }}</h2>
          <p>{{ current.body }}</p>
        </div>
      </Transition>
      <div class="card__bottom">
        <ol class="progress" aria-hidden="true">
          <li v-for="(step, i) in TOUR_STEPS" :key="step.title" :class="{ done: i <= shown }" />
        </ol>
        <button v-if="!isFirst" type="button" class="btn btn--ghost" @click="tour.back()">
          Back
        </button>
        <button ref="next" type="button" class="btn btn--primary" autofocus @click="tour.next()">
          {{ isFirst ? 'Show me around' : isLast ? 'Start racing' : 'Next' }}
        </button>
      </div>
      <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    </section>
  </dialog>
</template>

<style scoped>
.tour {
  position: fixed;
  inset: 0;
  width: 100%;
  max-width: none;
  height: 100%;
  max-height: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: none;
  color: var(--text);
}

.tour::backdrop {
  background: none;
}

.tour[open] {
  animation: tour-in 300ms var(--ease-out);
}

.tour.is-leaving {
  opacity: 0;
  transition: opacity 200ms ease;
}

/* The spotlight: one element whose huge spread shadow dims everything around it. */
.hole {
  position: absolute;
  top: 0;
  left: 0;
  box-shadow:
    0 0 0 3px rgb(255 255 255 / 0.35),
    0 0 0 200vmax rgb(0 0 0 / 0.6);
  pointer-events: none;
}

.card {
  position: absolute;
  top: 0;
  left: 0;
  width: 360px;
  padding: var(--space-5);
  /* Dark surfaces barely separate from the dimmed page, so the card gets an edge there. */
  border: 1px solid light-dark(transparent, var(--border));
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  box-shadow: var(--shadow-lg);
}

.card.is-sheet {
  width: calc(100vw - 2 * var(--space-4));
}

.is-moving .hole {
  transition:
    transform var(--tour-move) var(--ease-out),
    width var(--tour-move) var(--ease-out),
    height var(--tour-move) var(--ease-out),
    border-radius var(--tour-move) var(--ease-out);
}

.is-moving .card {
  transition: transform var(--tour-move) var(--ease-out);
}

.card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  margin-bottom: var(--space-2);
}

.count {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
}

.skip {
  padding: 0;
  border: 0;
  background: none;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-muted);
  text-decoration: underline;
  cursor: pointer;
}

.skip:hover {
  color: var(--text);
}

.card__text h2 {
  font-size: var(--text-lg);
  font-weight: 700;
  line-height: 1.3;
}

.card__text p {
  margin-top: var(--space-2);
  color: var(--text-muted);
  line-height: 1.5;
}

.card__bottom {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-5);
}

/* Same segmented bar as the round progress in the race header. */
.progress {
  display: flex;
  flex: 1;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.progress li {
  flex: 1;
  max-width: 20px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  transition: background var(--duration) ease;
}

.progress li.done {
  background: var(--text);
}

.swap-enter-active {
  transition:
    opacity 220ms var(--ease-out),
    transform 220ms var(--ease-out);
}

.swap-leave-active {
  transition: opacity 120ms ease;
}

.swap-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.swap-leave-to {
  opacity: 0;
}

@keyframes tour-in {
  from {
    opacity: 0;
  }
}
</style>
