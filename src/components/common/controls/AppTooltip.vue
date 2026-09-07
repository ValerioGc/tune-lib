<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';

export type TooltipPlacement = 'top' | 'bottom';
export type TooltipAlign = 'start' | 'center' | 'end';

const props = withDefaults(
  defineProps<{
    text: string;
    placement?: TooltipPlacement;
    align?: TooltipAlign;
    /** Kept quiet while the control it belongs to is turned off. */
    disabled?: boolean;
  }>(),
  { placement: 'top', align: 'end', disabled: false },
);

const GAP_PX = 6;

const isVisible = ref(false);
const isPositioned = ref(false);
const anchor = ref<HTMLElement | null>(null);
const bubble = ref<HTMLElement | null>(null);
const resolvedPlacement = ref<TooltipPlacement>(props.placement);
const position = ref({ top: 0, left: 0 });

function horizontalPosition(trigger: DOMRect, width: number): number {
  if (props.align === 'start') {
    return trigger.left;
  }

  if (props.align === 'end') {
    return trigger.right - width;
  }

  return trigger.left + trigger.width / 2 - width / 2;
}

/**
 * The bubble is placed against the window rather than against its trigger: several of the
 * controls that carry one live inside panels that clip their overflow, and an absolutely
 * positioned bubble would be cut off by them.
 */
function place() {
  const trigger = anchor.value;
  const box = bubble.value;

  if (trigger === null || box === null) {
    return;
  }

  const rect = trigger.getBoundingClientRect();
  const { width, height } = box.getBoundingClientRect();

  const above = rect.top - height - GAP_PX;
  const below = rect.bottom + GAP_PX;
  const fitsAbove = above >= GAP_PX;
  const fitsBelow = below + height <= window.innerHeight - GAP_PX;

  const useTop = props.placement === 'top' ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;

  resolvedPlacement.value = useTop ? 'top' : 'bottom';
  position.value = {
    top: useTop ? above : below,
    left: Math.min(
      Math.max(GAP_PX, horizontalPosition(rect, width)),
      Math.max(GAP_PX, window.innerWidth - width - GAP_PX),
    ),
  };
}

function hide() {
  isVisible.value = false;
  isPositioned.value = false;
  window.removeEventListener('scroll', hide, true);
  window.removeEventListener('resize', hide);
}

async function show() {
  if (props.disabled) {
    return;
  }

  isVisible.value = true;
  isPositioned.value = false;
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);

  await nextTick();

  if (!isVisible.value) {
    return;
  }

  place();
  isPositioned.value = true;
}

onBeforeUnmount(hide);
</script>

<template>
  <span
    ref="anchor"
    class="app_tooltip"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot></slot>
    <Teleport to="body">
      <span
        v-if="isVisible"
        ref="bubble"
        class="app_tooltip_bubble common_surface_sm"
        role="tooltip"
        :data-placement="resolvedPlacement"
        :style="{
          top: `${position.top}px`,
          left: `${position.left}px`,
          visibility: isPositioned ? 'visible' : 'hidden',
        }"
        >{{ text }}</span
      >
    </Teleport>
  </span>
</template>

<style lang="scss">
.app_tooltip {
  position: relative;
  display: inline-flex;
}

.app_tooltip_bubble {
  position: fixed;
  z-index: 100;
  padding: $space_xs $space_sm;
  box-shadow: var(--shadow_raised);
  color: var(--color_text);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
}
</style>
