<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import NumberStepper from '@/shared/components/NumberStepper.vue'
import { THEMES, useThemeStore } from '@/shared/stores/theme'
import { LIMITS, SPEED_OPTIONS } from '../domain/config'
import { DEFAULT_SETTINGS, normalizeSettings, type RaceSettings } from '../domain/settings'
import { useRaceStore } from '../stores/race'
import { useSettingsStore } from '../stores/settings'

const race = useRaceStore()
const setup = useSettingsStore()
const appearance = useThemeStore()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')

// The form edits a copy; nothing changes until "Create race day".
// (structuredClone can't copy Vue's reactive proxies, so copy by hand.)
const copy = (s: RaceSettings): RaceSettings => ({ ...s, distances: [...s.distances] })
const draft = ref(copy(DEFAULT_SETTINGS))
const seedInput = ref('')
const isSeedHelpOpen = ref(false)

// Start from the day on screen (a deep link can differ from the saved choices),
// and hold a running race so no round finishes unseen behind the dialog.
function open() {
  draft.value = copy(race.settings)
  seedInput.value = ''
  isSeedHelpOpen.value = false
  race.pause()
  dialog.value?.showModal()
}

// Esc closes an open tip first; with the tip closed it falls through and closes the dialog.
function closeSeedHelp(event: KeyboardEvent) {
  if (!isSeedHelpOpen.value) return
  event.preventDefault()
  event.stopPropagation()
  isSeedHelpOpen.value = false
}

// Only a press that starts on the backdrop closes the dialog; a text selection
// that starts inside the box and ends outside it must not throw the edits away.
let pressedBackdrop = false
const onPointerDown = (event: PointerEvent) =>
  (pressedBackdrop = event.target === event.currentTarget)
function onBackdropClick() {
  if (pressedBackdrop) setup.isSetupOpen = false
}

watch(
  () => setup.isSetupOpen,
  (isOpen) => (isOpen ? open() : dialog.value?.close()),
)

// Keep dependent fields valid as the user edits: per-round never exceeds the stable.
watch(
  () => draft.value.horseCount,
  (count) => (draft.value.horsesPerRound = Math.min(draft.value.horsesPerRound, count)),
)

// A writable computed: reads the round count from the distance list, and writing it
// adds rounds (each 200m longer than the last) or drops them from the end.
const roundCount = computed({
  get: () => draft.value.distances.length,
  set: (count) => {
    const distances = draft.value.distances
    while (distances.length < count) {
      const last = distances[distances.length - 1] ?? 1000
      distances.push(Math.min(LIMITS.distance.max, last + LIMITS.distance.step))
    }
    distances.length = count
  },
})

function reset() {
  draft.value = copy(DEFAULT_SETTINGS)
  seedInput.value = ''
}

function create() {
  const next = normalizeSettings({ ...draft.value, seed: seedInput.value || null })
  setup.save(next)
  race.newRaceDay(next)
  setup.isSetupOpen = false
}
</script>

<template>
  <dialog
    ref="dialog"
    class="setup"
    aria-labelledby="setup-title"
    @close="setup.isSetupOpen = false"
    @pointerdown="onPointerDown"
    @click.self="onBackdropClick"
  >
    <form @submit.prevent="create">
      <header class="setup__header">
        <button type="button" class="close" aria-label="Close" @click="setup.isSetupOpen = false">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
        <h2 id="setup-title">New race day</h2>
      </header>

      <div class="setup__body">
        <section class="row">
          <div>
            <h3>Horses</h3>
            <p>How many horses live in the stable</p>
          </div>
          <NumberStepper
            v-model="draft.horseCount"
            label="horses"
            :min="LIMITS.horseCount.min"
            :max="LIMITS.horseCount.max"
          />
        </section>

        <section class="row">
          <div>
            <h3>Horses per round</h3>
            <p>Drawn at random for every round</p>
          </div>
          <NumberStepper
            v-model="draft.horsesPerRound"
            label="horses per round"
            :min="1"
            :max="draft.horseCount"
          />
        </section>

        <section>
          <div class="row">
            <div>
              <h3>Rounds</h3>
              <p>Each round can run its own distance</p>
            </div>
            <NumberStepper
              v-model="roundCount"
              label="rounds"
              :min="LIMITS.rounds.min"
              :max="LIMITS.rounds.max"
            />
          </div>
          <ol class="distances">
            <li v-for="(_, i) in draft.distances" :key="i" class="row row--compact">
              <span>Round {{ i + 1 }}</span>
              <NumberStepper
                v-model="draft.distances[i]!"
                :label="`round ${i + 1} distance`"
                unit="m"
                :min="LIMITS.distance.min"
                :max="LIMITS.distance.max"
                :step="LIMITS.distance.step"
              />
            </li>
          </ol>
        </section>

        <section class="row">
          <div>
            <h3 id="countdown-label">Countdown</h3>
            <p>3, 2, 1 before every round</p>
          </div>
          <input
            v-model="draft.countdown"
            type="checkbox"
            role="switch"
            class="switch"
            aria-labelledby="countdown-label"
          />
        </section>

        <section class="row">
          <div>
            <h3 id="speed-label">Starting speed</h3>
            <p>You can change it during the race too</p>
          </div>
          <div class="pills" role="radiogroup" aria-labelledby="speed-label">
            <label v-for="option in SPEED_OPTIONS" :key="option">
              <input v-model="draft.speed" type="radio" name="speed" :value="option" />
              <span>{{ option }}×</span>
            </label>
          </div>
        </section>

        <section class="row">
          <div>
            <h3 id="theme-label">Appearance</h3>
            <p>Applies right away. System follows your device.</p>
          </div>
          <!-- Bound to the theme store, not the draft: appearance changes instantly. -->
          <div class="pills" role="radiogroup" aria-labelledby="theme-label">
            <label v-for="option in THEMES" :key="option">
              <input v-model="appearance.theme" type="radio" name="theme" :value="option" />
              <span>{{ option[0]!.toUpperCase() + option.slice(1) }}</span>
            </label>
          </div>
        </section>

        <section class="row">
          <div>
            <div class="with-info">
              <h3><label for="seed">Seed</label></h3>
              <!-- Toggletip: opens on click or focus, so it works for touch and keyboard too. -->
              <span class="info">
                <button
                  type="button"
                  class="info__button"
                  aria-label="What is a seed?"
                  :aria-expanded="isSeedHelpOpen"
                  aria-controls="seed-help"
                  @click="isSeedHelpOpen = !isSeedHelpOpen"
                  @blur="isSeedHelpOpen = false"
                  @keydown.esc="closeSeedHelp"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <circle
                      cx="8"
                      cy="8"
                      r="6.75"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                    <path
                      d="M8 7v4.5"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                    />
                    <circle cx="8" cy="4.75" r="1" fill="currentColor" />
                  </svg>
                </button>
                <span v-show="isSeedHelpOpen" id="seed-help" class="info__bubble" role="status">
                  A seed is the starting number behind every random draw: the horses, the programs
                  and the race results. The same seed always rebuilds the same race day, so you can
                  replay it. Leave it empty for a fresh day. This race day's seed is
                  <b>{{ race.seed }}</b
                  >.
                </span>
              </span>
            </div>
            <p>Optional. Same seed, same race day.</p>
          </div>
          <input
            id="seed"
            v-model.trim="seedInput"
            class="input"
            inputmode="numeric"
            pattern="\d{1,6}"
            maxlength="6"
            placeholder="Random"
            autocomplete="off"
          />
        </section>
      </div>

      <footer class="setup__footer">
        <button type="button" class="btn btn--ghost" @click="reset">Reset to defaults</button>
        <button type="submit" class="btn btn--primary">Create race day</button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.setup {
  width: min(568px, calc(100vw - 2 * var(--space-4)));
  max-height: min(90dvh, 820px);
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  color: var(--text);
  box-shadow: var(--shadow-lg);
}

.setup[open] {
  animation: rise 320ms var(--ease-out);
}

.setup::backdrop {
  background: rgb(0 0 0 / 0.5);
}

form {
  display: flex;
  flex-direction: column;
  max-height: inherit;
}

.setup__header {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 64px;
  border-bottom: 1px solid var(--border-soft);
}

.setup__header h2 {
  font-size: var(--text-md);
  font-weight: 700;
}

.close {
  position: absolute;
  left: var(--space-4);
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}

.close:hover {
  background: var(--bg-subtle);
}

/* min-height: 0 lets the body shrink inside the column, so it scrolls instead of the dialog. */
.setup__body {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 0 var(--space-5);
}

.setup__body > section {
  padding: var(--space-5) 0;
  border-bottom: 1px solid var(--border-soft);
}

.setup__body > section:last-child {
  border-bottom: 0;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

/* The label shrinks to 140px before a wide control drops to its own line (narrow phones). */
.row > div:first-child {
  flex: 1 1 140px;
}

h3 {
  font-size: var(--text-md);
  font-weight: 600;
}

.row p {
  color: var(--text-muted);
}

.distances {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding-left: var(--space-4);
  border-left: 2px solid var(--border-soft);
}

.row--compact {
  color: var(--text-muted);
}

.switch {
  position: relative;
  flex-shrink: 0;
  width: 48px;
  height: 32px;
  margin: 0;
  appearance: none;
  border-radius: var(--radius-pill);
  background: var(--border);
  cursor: pointer;
  transition: background var(--duration) var(--ease-out);
}

.switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration) var(--ease-out);
}

.switch:checked {
  background: var(--bg-strong);
}

/* The knob takes the "on strong" colour, so it contrasts with the track in both themes. */
.switch:checked::after {
  background: var(--text-on-strong);
  transform: translateX(16px);
}

.pills {
  display: flex;
  gap: var(--space-2);
}

/* The hidden radio sits on its own pill, so it stays inside the scrolling body. */
.pills label {
  position: relative;
}

.pills input {
  position: absolute;
  opacity: 0;
}

.pills span {
  display: block;
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  cursor: pointer;
}

.pills input:checked + span {
  border-color: var(--border-strong);
  background: var(--bg-strong);
  color: var(--text-on-strong);
}

.pills input:focus-visible + span {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.with-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.info {
  position: relative;
  display: inline-flex;
}

.info__button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}

.info__button:hover,
.info__button[aria-expanded='true'] {
  background: var(--bg-subtle);
  color: var(--text);
}

/* Opens upwards: the seed row is the last one, so there's always room above it. */
.info__bubble {
  position: absolute;
  bottom: calc(100% + var(--space-2));
  left: -12px;
  z-index: 1;
  width: min(300px, 70vw);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-soft); /* defines the edge in dark mode, where shadows fade */
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-sm);
  font-weight: 400;
  line-height: 1.5;
  color: var(--text);
}

.input {
  width: 120px;
  height: 48px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  font-size: var(--text-md);
}

.input:focus {
  border-color: var(--border-strong);
  outline: 1px solid var(--border-strong);
}

.input:invalid {
  border-color: var(--color-rausch-deep);
}

.setup__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-soft);
}

.setup__footer .btn--ghost {
  padding: 0;
}

.setup__footer .btn--primary {
  min-height: 48px;
  padding: 0 var(--space-5);
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
}
</style>
