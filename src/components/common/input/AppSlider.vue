<script setup lang="ts">
import { useId } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    label: string;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    hideLabel?: boolean;
    valueText?: string;
  }>(),
  { min: 0, max: 100, step: 1, disabled: false, hideLabel: false, valueText: '' },
);

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const inputId = useId();

function onInput(event: Event) {
  emit('update:modelValue', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="app_slider">
    <label class="app_slider_label" :class="{ common_visually_hidden: hideLabel }" :for="inputId">
      {{ label }}
    </label>
    <input
      :id="inputId"
      class="app_slider_field"
      type="range"
      :min="props.min"
      :max="props.max"
      :step="props.step"
      :value="props.modelValue"
      :disabled="props.disabled"
      :aria-valuetext="props.valueText === '' ? undefined : props.valueText"
      @input="onInput"
    />
  </div>
</template>

<style scoped lang="scss">
.app_slider {
  display: flex;
  flex: 1;
  gap: $space_xs;
  align-items: center;
  min-width: 0;

  &_label {
    color: var(--color_text_muted);
    font-size: 0.875em;
  }

  &_field {
    flex: 1;
    min-width: 0;
    height: 1rem;
    accent-color: var(--color_accent);
    cursor: pointer;

    @include focus_ring;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}
</style>
