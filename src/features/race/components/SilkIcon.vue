<script setup lang="ts">
import { computed, useId } from 'vue'
import type { Horse } from '../domain/types'
import { contrastColor } from '../utils/format'

const { horse, size = 24 } = defineProps<{ horse: Horse; size?: number }>()

// The horse's unique colour is the silk; the pattern only adds character.
const PATTERNS = ['plain', 'hoops', 'stripes', 'chevron', 'quarters', 'sash'] as const
const pattern = computed(() => PATTERNS[(horse.id - 1) % PATTERNS.length])
const trim = computed(() => contrastColor(horse.color.hex))
const clipId = useId()

const SHIRT = 'M6 3 L10 1 H14 L18 3 L23 7 L20 11 L18 9.5 V22 H6 V9.5 L4 11 L1 7 Z'
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true" class="silk">
    <clipPath :id="clipId"><path :d="SHIRT" /></clipPath>
    <g :clip-path="`url(#${clipId})`" :fill="trim">
      <rect width="24" height="24" :fill="horse.color.hex" />
      <template v-if="pattern === 'hoops'">
        <rect y="9" width="24" height="3" />
        <rect y="15" width="24" height="3" />
      </template>
      <template v-else-if="pattern === 'stripes'">
        <rect x="8" width="2.5" height="24" />
        <rect x="13.5" width="2.5" height="24" />
      </template>
      <path v-else-if="pattern === 'chevron'" d="M2 8 L12 15 L22 8 V12 L12 19 L2 12Z" />
      <template v-else-if="pattern === 'quarters'">
        <rect x="12" width="12" height="12" />
        <rect y="12" width="12" height="12" />
      </template>
      <path v-else-if="pattern === 'sash'" d="M5 2 L9 2 L20 22 L16 22Z" />
    </g>
    <path :d="SHIRT" fill="none" stroke="rgb(20 33 26 / 0.35)" />
  </svg>
</template>

<style scoped>
.silk {
  flex-shrink: 0;
  display: block;
}
</style>
