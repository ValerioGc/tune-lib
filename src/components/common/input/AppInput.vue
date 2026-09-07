<script setup lang="ts">
import { useId } from 'vue';

withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    placeholder?: string;
    type?: 'text' | 'search' | 'number';
    hideLabel?: boolean;
    maxLength?: number | undefined;
    disabled?: boolean;
  }>(),
  {
    placeholder: '',
    type: 'text',
    hideLabel: false,
    maxLength: undefined,
    disabled: false,
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const inputId = useId();

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="app_input">
    <label
      class="app_input_label"
      :class="{ app_input_label_hidden: hideLabel, common_visually_hidden: hideLabel }"
      :for="inputId"
      >{{ label }}</label
    >
    <input
      :id="inputId"
      class="app_input_field"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :maxlength="maxLength"
      :disabled="disabled"
      @input="onInput"
    />
  </div>
</template>

<style scoped lang="scss">
.app_input {
  display: flex;
  flex-direction: column;
  gap: $space_sm;

  &_label {
    font-size: 0.875em;
    color: var(--color_text_muted);
  }

  &_field {
    min-height: 2rem;
    padding: $space_sm $space_md;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_md;
    background-color: var(--color_surface);
    color: var(--color_text);
    font: inherit;
    transition: border-color $duration_fast ease;

    &::placeholder {
      color: var(--color_text_muted);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:focus-visible {
      outline: 2px solid var(--color_accent);
      outline-offset: 1px;
    }
  }
}
</style>
