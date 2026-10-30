<script setup lang="ts">
import { computed } from 'vue'
import type { Horse } from '../domain/types'
import { contrastColor } from '../utils/format'

/**
 * Eadweard Muybridge's 1878 "Horse in Motion" frames (public domain), painted in the horse's
 * colour through a CSS mask. Kept as its own component so the artwork can change on its own.
 */
const { horse, pose } = defineProps<{ horse: Horse; pose: 'stand' | 'gallop' | 'hold' }>()
const outline = computed(() => contrastColor(horse.color.hex))
</script>

<template>
  <span
    class="figure"
    :class="`figure--${pose}`"
    :style="{ '--coat': horse.color.hex, '--outline': outline }"
    aria-hidden="true"
  >
    <span class="sprite" />
  </span>
</template>

<style scoped>
.figure {
  position: absolute;
  right: 100%;
  width: var(--figure-width);
  aspect-ratio: 184 / 116;
  overflow: hidden;
  /* An outline in the contrast colour keeps every coat readable on the turf. */
  filter: drop-shadow(0 0 0.6px var(--outline)) drop-shadow(0 0 0.6px var(--outline));
}

.sprite {
  display: block;
  height: 100%;
  background: var(--coat);
  mask: url('@/assets/horse-gallop.png') 0 0 / 100% 100% no-repeat;
}

.figure--gallop .sprite,
.figure--hold .sprite {
  width: 1100%; /* 11 frames side by side */
  animation: gallop calc(0.5s / var(--speed, 1)) steps(11) infinite;
}

.figure--hold .sprite {
  animation-play-state: paused;
}

.figure--stand .sprite {
  width: 100%;
  mask-image: url('@/assets/horse-stand.png');
}

/* Moving the strip with transform keeps the frame swap on the compositor. */
@keyframes gallop {
  to {
    transform: translateX(-100%);
  }
}
</style>
