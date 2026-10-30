<script setup lang="ts">
import { computed } from 'vue'
import type { Horse } from '../domain/types'
import { contrastColor } from '../utils/format'

// Kept as its own component so the horse artwork can be swapped without touching the track.
const { horse, number, running } = defineProps<{ horse: Horse; number: number; running: boolean }>()
const trim = computed(() => contrastColor(horse.color.hex))
</script>

<template>
  <svg class="figure" :class="{ running }" viewBox="0 0 64 40" aria-hidden="true">
    <g fill="#EFEBDD" stroke="rgb(20 33 26 / 0.35)" stroke-width="0.5">
      <ellipse cx="28" cy="22" rx="15" ry="6.5" />
      <path d="M39 19 L48 9 L54 8 L58 11 L56 13 L50 13 L44 22Z" />
      <path d="M14 20 L4 16 L6 19 L13 23Z" />
      <path d="M18 25 L10 34 L12 35 L21 27Z" />
      <path d="M22 26 L20 37 L22.5 37 L25 27Z" />
      <path d="M34 26 L42 35 L44 34 L37 25Z" />
      <path d="M38 25 L48 31 L49 29 L40 23Z" />
    </g>
    <rect
      x="23"
      y="17"
      width="10"
      height="7"
      rx="1"
      :fill="horse.color.hex"
      :stroke="trim"
      stroke-width="0.8"
    />
    <text x="28" y="22.6" font-size="5.5" font-weight="800" text-anchor="middle" :fill="trim">
      {{ number }}
    </text>
    <path
      d="M27 16 L30 7 L35 6 L36 9 L33 15Z"
      :fill="horse.color.hex"
      stroke="rgb(20 33 26 / 0.4)"
      stroke-width="0.6"
    />
    <circle
      cx="34"
      cy="4.5"
      r="3"
      :fill="horse.color.hex"
      stroke="rgb(20 33 26 / 0.4)"
      stroke-width="0.6"
    />
  </svg>
</template>

<style scoped>
.figure {
  display: block;
  width: var(--figure-width);
  height: auto;
  overflow: visible;
}

.running {
  animation: gallop 0.36s ease-in-out infinite alternate;
}

@keyframes gallop {
  to {
    transform: translateY(-2px) rotate(-1.5deg);
  }
}
</style>
