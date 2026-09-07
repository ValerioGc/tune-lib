<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    label?: string;
    /**
     * How much room it takes. A dialog waiting on one read asks for little; a window opening
     * on an empty screen asks for enough to be the thing being looked at.
     */
    size?: 'small' | 'medium' | 'large';
  }>(),
  { label: '', size: 'medium' },
);

const { t } = useI18n();
const accessibleLabel = computed(() => props.label || t('common.loading'));
</script>

<template>
  <div
    class="app_spinner"
    :class="{
      app_spinner_small: size === 'small',
      app_spinner_medium: size === 'medium',
      app_spinner_large: size === 'large',
    }"
    role="status"
    :aria-label="accessibleLabel"
    aria-live="polite"
  >
    <svg class="app_spinner_ring" viewBox="0 0 44 44" aria-hidden="true">
      <circle class="app_spinner_track" cx="22" cy="22" r="18" />
      <circle class="app_spinner_arc" cx="22" cy="22" r="18" />
    </svg>
    <span class="common_visually_hidden">{{ accessibleLabel }}</span>
  </div>
</template>

<style scoped lang="scss">
.app_spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &_small {
    --app_spinner_size: 1.5rem;
  }

  &_medium {
    --app_spinner_size: 2.5rem;
  }

  &_large {
    --app_spinner_size: 4.5rem;
  }

  // Two movements, not one. The ring turns at a steady pace while the arc drawn on it grows
  // and shrinks against that turn: the head runs ahead, the tail catches up, and the eye
  // follows something that changes rather than a line going round at one speed.
  &_ring {
    width: var(--app_spinner_size, 2.5rem);
    height: var(--app_spinner_size, 2.5rem);
    animation: app_spinner_turn 1.8s linear infinite;
  }

  circle {
    transform-box: fill-box;
    transform-origin: center;
    fill: none;
    stroke-width: 3.5;
    stroke-linecap: round;
  }

  // The whole circle, faint: the arc runs on a track rather than on nothing, so the shape
  // stays a ring even at the moment the arc is at its shortest.
  &_track {
    stroke: color-mix(in srgb, var(--color_accent) 16%, transparent);
  }

  &_arc {
    stroke: var(--color_accent);
    // The circumference of a circle of radius 18, which is the length the dashes are cut from.
    stroke-dasharray: 113;
    animation: app_spinner_sweep 1.5s ease-in-out infinite;
  }
}

// Left turning, slowly, with the arc held at one length: the wait is still shown, without
// anything moving against anything else.
@media (prefers-reduced-motion: reduce) {
  .app_spinner_ring {
    animation-duration: 3.5s;
  }

  .app_spinner_arc {
    stroke-dashoffset: 62;
    animation: none;
  }
}

@keyframes app_spinner_turn {
  to {
    transform: rotate(360deg);
  }
}

@keyframes app_spinner_sweep {
  0% {
    transform: rotate(0deg);
    stroke-dashoffset: 106;
  }

  50% {
    transform: rotate(135deg);
    stroke-dashoffset: 30;
  }

  100% {
    transform: rotate(450deg);
    stroke-dashoffset: 106;
  }
}
</style>
