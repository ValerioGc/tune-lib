<script setup lang="ts">
import { useId } from 'vue';

import type { SelectOption } from '@/types/ui';

withDefaults(
  defineProps<{
    modelValue: string;
    options: readonly SelectOption[];
    label: string;
    hideLabel?: boolean;
  }>(),
  { hideLabel: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const selectId = useId();

function onChange(event: Event) {
  emit('update:modelValue', (event.target as HTMLSelectElement).value);
}
</script>

<template>
  <div class="app_select">
    <label
      class="app_select_label"
      :class="{ app_select_label_hidden: hideLabel, common_visually_hidden: hideLabel }"
      :for="selectId"
      >{{ label }}</label
    >
    <select :id="selectId" class="app_select_field" :value="modelValue" @change="onChange">
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<style scoped lang="scss">
.app_select {
  display: flex;
  flex-direction: column;
  gap: $space_sm;

  &_label {
    font-size: 0.875em;
    color: var(--color_text_muted);
  }

  &_field {
    min-width: 12rem;
    padding: $space_sm $space_md;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_md;
    background-color: var(--color_surface);
    color: var(--color_text);
    font: inherit;
    cursor: pointer;
    transition:
      border-color $duration_fast ease,
      background-color $duration_fast ease;

    &:hover {
      background-color: var(--color_surface_hover);
    }

    &:focus-visible {
      outline: 2px solid var(--color_accent);
      outline-offset: 1px;
    }
  }
}
</style>
