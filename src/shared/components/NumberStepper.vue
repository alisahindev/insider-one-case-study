<script setup lang="ts">
// Airbnb-style "− 2 +" counter. defineModel gives two-way binding: v-model="settings.horseCount".
const value = defineModel<number>({ required: true })
const {
  min,
  max,
  step = 1,
  label,
  unit = '',
} = defineProps<{
  min: number
  max: number
  step?: number
  label: string
  unit?: string
}>()
</script>

<template>
  <div class="stepper" role="group" :aria-label="label">
    <button
      type="button"
      class="icon-btn"
      :disabled="value <= min"
      :aria-label="`Decrease ${label}`"
      @click="value = Math.max(min, value - step)"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2 6h8" stroke="currentColor" stroke-width="1.6" />
      </svg>
    </button>
    <output aria-live="polite">{{ value }}{{ unit }}</output>
    <button
      type="button"
      class="icon-btn"
      :disabled="value >= max"
      :aria-label="`Increase ${label}`"
      @click="value = Math.min(max, value + step)"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2 6h8M6 2v8" stroke="currentColor" stroke-width="1.6" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.stepper {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
}

output {
  min-width: 3.5ch;
  font-size: var(--text-md);
  text-align: center;
}
</style>
