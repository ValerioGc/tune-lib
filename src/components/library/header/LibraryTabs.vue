<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

/** One entry of the strip: `id` is what the caller works with, `label` what is read. */
export interface LibraryTab {
  id: string;
  label: string;
}

const props = defineProps<{
  modelValue: string;
  tabs: readonly LibraryTab[];
  /** Read out as the name of the strip. */
  label: string;
  /** Builds the ids tying each tab to its panel: `${idBase}-tab-x`, `${idBase}-panel-x`. */
  idBase: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const list = ref<HTMLElement | null>(null);
const buttons = ref<HTMLButtonElement[]>([]);
const indicator = ref({ left: 0, width: 0, ready: false });

let observer: ResizeObserver | null = null;

function collect(element: unknown, index: number) {
  buttons.value[index] = element as HTMLButtonElement;
}

/**
 * Places the underline under the selected tab. Measured rather than styled per tab so the
 * bar slides between the sections instead of blinking from one to the next.
 */
function measureIndicator() {
  const index = props.tabs.findIndex((tab) => tab.id === props.modelValue);
  const button = buttons.value[index];

  if (button === undefined || button.offsetWidth === 0) {
    indicator.value = { ...indicator.value, ready: false };
    return;
  }

  indicator.value = { left: button.offsetLeft, width: button.offsetWidth, ready: true };
}

function select(id: string) {
  emit('update:modelValue', id);
}

/** Arrow keys move between the tabs, as expected from a tablist. */
async function onKeydown(event: KeyboardEvent, index: number) {
  const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
  const offset = offsets[event.key];

  let target: number | null = null;

  if (offset !== undefined) {
    target = (index + offset + props.tabs.length) % props.tabs.length;
  } else if (event.key === 'Home') {
    target = 0;
  } else if (event.key === 'End') {
    target = props.tabs.length - 1;
  }

  const next = target === null ? undefined : props.tabs[target];

  if (target === null || next === undefined) {
    return;
  }

  event.preventDefault();
  select(next.id);
  await nextTick();
  buttons.value[target]?.focus();
}

watch([() => props.modelValue, () => props.tabs], async () => {
  await nextTick();
  measureIndicator();
});

onMounted(() => {
  measureIndicator();

  // The bar follows the tabs when the window, the text size or the language changes.
  if (typeof ResizeObserver !== 'undefined' && list.value !== null) {
    observer = new ResizeObserver(() => measureIndicator());
    observer.observe(list.value);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
</script>

<template>
  <div ref="list" class="library_tabs" role="tablist" :aria-label="props.label">
    <button
      v-for="(tab, index) in props.tabs"
      :id="`${props.idBase}-tab-${tab.id}`"
      :key="tab.id"
      :ref="(element) => collect(element, index)"
      class="library_tabs_tab"
      :class="{ library_tabs_tab_active: tab.id === props.modelValue }"
      type="button"
      role="tab"
      :aria-selected="tab.id === props.modelValue"
      :aria-controls="`${props.idBase}-panel-${tab.id}`"
      :tabindex="tab.id === props.modelValue ? 0 : -1"
      @click="select(tab.id)"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
    </button>

    <span
      v-show="indicator.ready"
      class="library_tabs_indicator"
      aria-hidden="true"
      :style="{ transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px` }"
    />
  </div>
</template>

<style scoped lang="scss">
.library_tabs {
  display: flex;
  position: relative;
  gap: $space_sm;
  align-items: center;
  flex-shrink: 0;
  padding-bottom: $space_sm;

  // The rail the indicator runs on, drawn under the whole strip.
  &::after {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 1px;
    background-color: var(--color_border);
    content: '';
  }

  &_tab {
    position: relative;
    z-index: 1;
    flex: 0 0 auto;
    min-height: 2rem;
    padding: $space_xs $space_sm;
    border: 0;
    border-radius: $radius_sm;
    background-color: transparent;
    color: var(--color_text_muted);
    font: inherit;
    font-size: 1.0625em;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: color $duration_fast ease;

    @include focus_ring;

    &:hover {
      color: var(--color_text);
    }

    &_active {
      color: var(--color_accent);
      font-weight: 600;
    }
  }

  &_indicator {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    border-radius: 999px;
    background-color: var(--color_accent);
    transition:
      transform $duration_base cubic-bezier(0.2, 0, 0, 1),
      width $duration_base cubic-bezier(0.2, 0, 0, 1);
    will-change: transform, width;
  }
}
</style>
