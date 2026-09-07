<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/controls/AppTooltip.vue';
import type { SortDirection } from '@/types/library';
import type { SelectOption } from '@/types/ui';

/**
 * The order of a view that has no column headers to click.
 *
 * It only draws and reports: the tracks answer to the library store, the artists and the
 * albums to the list that gathers them, and both drive the same control.
 */
const props = withDefaults(
  defineProps<{
    column: string;
    direction: SortDirection;
    options: readonly SelectOption[];
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{ select: [column: string] }>();

const { t } = useI18n();
const isOpen = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const optionButtons = ref<HTMLButtonElement[]>([]);
const listboxId = useId();

const selectedOption = computed(
  () => props.options.find((option) => option.value === props.column) ?? props.options[0],
);

const directionLabel = computed(() =>
  props.direction === 'asc' ? t('library.sort.ascending') : t('library.sort.descending'),
);

function collectOption(element: unknown, index: number) {
  if (element instanceof HTMLButtonElement) {
    optionButtons.value[index] = element;
  }
}

function closeMenu(restoreFocus = false) {
  isOpen.value = false;

  if (restoreFocus) {
    trigger.value?.focus();
  }
}

async function openMenu() {
  isOpen.value = true;
  await nextTick();

  const selectedIndex = props.options.findIndex((option) => option.value === props.column);
  optionButtons.value[selectedIndex === -1 ? 0 : selectedIndex]?.focus();
}

async function toggleMenu() {
  if (isOpen.value) {
    closeMenu();
    return;
  }

  await openMenu();
}

function selectOption(column: string) {
  emit('select', column);
  closeMenu(true);
}

async function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    await openMenu();
  }
}

function onOptionKeydown(event: KeyboardEvent, index: number) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeMenu(true);
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const option = props.options[index];

    if (option !== undefined) {
      selectOption(option.value);
    }

    return;
  }

  const offsets: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
  const offset = offsets[event.key];

  if (offset === undefined || props.options.length === 0) {
    return;
  }

  event.preventDefault();
  const nextIndex = (index + offset + props.options.length) % props.options.length;
  optionButtons.value[nextIndex]?.focus();
}

function onDocumentPointerdown(event: PointerEvent) {
  if (root.value !== null && !root.value.contains(event.target as Node)) {
    closeMenu();
  }
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    closeMenu(true);
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerdown);
  document.addEventListener('keydown', onDocumentKeydown);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerdown);
  document.removeEventListener('keydown', onDocumentKeydown);
});

/** Asking again for the column in use is what turns the order around. */
function toggleDirection() {
  emit('select', props.column);
}
</script>

<template>
  <div class="library_sort_select">
    <div ref="root" class="library_sort_select_field">
      <button
        ref="trigger"
        class="library_sort_select_trigger"
        type="button"
        :aria-label="t('library.sort.field')"
        :aria-expanded="isOpen"
        aria-haspopup="listbox"
        :aria-controls="listboxId"
        :disabled="disabled"
        data-testid="preview-sort-field"
        @click="toggleMenu"
        @keydown="onTriggerKeydown"
      >
        <span class="library_sort_select_value">{{ selectedOption?.label }}</span>
        <AppIcon name="collapse" />
      </button>

      <div
        v-if="isOpen"
        :id="listboxId"
        class="library_sort_select_options"
        role="listbox"
        :aria-label="t('library.sort.field')"
        data-testid="preview-sort-options"
      >
        <button
          v-for="(option, index) in props.options"
          :key="option.value"
          :ref="(element) => collectOption(element, index)"
          class="library_sort_select_option"
          :class="{ library_sort_select_option_active: option.value === props.column }"
          type="button"
          role="option"
          :aria-selected="option.value === props.column"
          :data-testid="`preview-sort-option-${option.value}`"
          @click="selectOption(option.value)"
          @keydown="onOptionKeydown($event, index)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- Asking again for the column in use is what turns the order around. -->
    <AppTooltip :text="directionLabel" align="center" :disabled="disabled">
      <button
        class="library_sort_select_direction"
        type="button"
        :aria-label="directionLabel"
        :disabled="disabled"
        data-testid="preview-sort-direction"
        @click="toggleDirection"
      >
        <AppIcon :name="props.direction === 'asc' ? 'sortAsc' : 'sortDesc'" />
      </button>
    </AppTooltip>
  </div>
</template>

<style scoped lang="scss">
// Both halves are given the same height rather than left to their own padding: the select
// is a custom control and the button is not, and they never land on the same line by chance.
$sort_control_height: 2.25rem;

.library_sort_select {
  display: flex;
  gap: $space_xs;
  align-items: center;

  &_field {
    position: relative;
    min-width: 8rem;
  }

  &_trigger {
    display: flex;
    gap: $space_sm;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: $sort_control_height;
    padding: 0 $space_sm;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_md;
    background-color: var(--color_surface);
    color: var(--color_text);
    font: inherit;
    cursor: pointer;
    transition:
      border-color $duration_fast ease,
      background-color $duration_fast ease;

    &:hover:not(:disabled),
    &[aria-expanded='true'] {
      border-color: var(--color_accent);
      background-color: var(--color_surface_hover);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @include focus_ring;
  }

  &_value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_options {
    position: absolute;
    top: calc(100% + #{$space_xs});
    right: 0;
    left: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    padding: $space_xs;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_md;
    background-color: var(--color_surface);
    box-shadow: var(--shadow_raised);
  }

  &_option {
    width: 100%;
    min-height: $sort_control_height;
    padding: $space_sm;
    border: 0;
    border-radius: $radius_sm;
    background-color: transparent;
    color: var(--color_text);
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      background-color: var(--color_accent);
      color: var(--color_on_accent);
    }

    &_active {
      font-weight: 600;
    }
  }

  &_direction {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: $sort_control_height;
    height: $sort_control_height;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_md;
    background-color: var(--color_surface);
    color: var(--color_text);
    font: inherit;
    cursor: pointer;
    transition:
      border-color $duration_fast ease,
      background-color $duration_fast ease,
      color $duration_fast ease;

    &:hover:not(:disabled) {
      border-color: var(--color_accent);
      background-color: var(--color_accent);
      color: var(--color_on_accent);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @include focus_ring;
  }
}
</style>
