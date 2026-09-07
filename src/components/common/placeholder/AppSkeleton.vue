<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * What the placeholder stands in for: a line of writing, a picture or a panel, a round
     * button. It only decides the shape.
     */
    variant?: 'text' | 'box' | 'circle';
    /**
     * How much room to take, in any CSS length. Left out, the placeholder takes the width of
     * whatever holds it and the height its shape gives it, so a caller can size it from a
     * stylesheet instead — an inline size would win over that.
     */
    width?: string;
    height?: string;
  }>(),
  { variant: 'text', width: '', height: '' },
);

const size = computed(() => ({
  ...(props.width === '' ? {} : { width: props.width }),
  ...(props.height === '' ? {} : { height: props.height }),
}));
</script>

<template>
  <span
    class="app_skeleton"
    :class="{
      app_skeleton_text: variant === 'text',
      app_skeleton_box: variant === 'box',
      app_skeleton_circle: variant === 'circle',
    }"
    :style="size"
    aria-hidden="true"
  ></span>
</template>

<style scoped lang="scss">
// A shape of the colour of the text, faint enough to read as an absence rather than as
// content, sweeping slowly so it is plainly something on its way rather than something that
// arrived empty.
.app_skeleton {
  display: block;
  flex-shrink: 0;
  background: linear-gradient(
    100deg,
    color-mix(in srgb, var(--color_text) 10%, transparent) 20%,
    color-mix(in srgb, var(--color_text) 24%, transparent) 50%,
    color-mix(in srgb, var(--color_text) 10%, transparent) 80%
  );
  background-size: 200% 100%;
  animation: app_skeleton_sweep 1.25s ease-in-out infinite;

  &_text {
    height: 0.7rem;
    border-radius: 999px;
  }

  &_box {
    border-radius: $radius_sm;
  }

  &_circle {
    border-radius: 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app_skeleton {
    animation: none;
  }
}

@keyframes app_skeleton_sweep {
  from {
    background-position: 100% 0;
  }

  to {
    background-position: -100% 0;
  }
}
</style>
