<script setup lang="ts">
import { useId } from 'vue';

withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    error?: string | null;
    type?: 'text' | 'number';
    placeholder?: string;
    suggestions?: readonly string[];
  }>(),
  { error: null, type: 'text', placeholder: '', suggestions: () => [] },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const fieldId = useId();
const errorId = useId();
const listId = useId();

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="metadata_field">
    <label class="metadata_field_label" :for="fieldId">{{ label }}</label>
    <input
      :id="fieldId"
      class="metadata_field_input"
      :class="{ metadata_field_input_invalid: error !== null }"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :list="suggestions.length > 0 ? listId : undefined"
      :aria-invalid="error !== null"
      :aria-describedby="error === null ? undefined : errorId"
      @input="onInput"
    />
    <datalist v-if="suggestions.length > 0" :id="listId">
      <option v-for="suggestion in suggestions" :key="suggestion" :value="suggestion"></option>
    </datalist>
    <p v-if="error !== null" :id="errorId" class="metadata_field_error" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.metadata_field {
  display: flex;
  flex-direction: column;
  gap: $space_xs;

  &_label {
    font-size: 0.875em;
    color: var(--color_text_muted);
  }

  &_input {
    min-height: 2rem;
    padding: $space_sm $space_md;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_md;
    background-color: var(--color_surface);
    color: var(--color_text);
    font: inherit;

    &:focus-visible {
      outline: 2px solid var(--color_accent);
      outline-offset: 1px;
    }

    &_invalid {
      border-color: #c42b1c;
    }
  }

  &_error {
    color: #c42b1c;
    font-size: 0.8125em;
  }
}
</style>
