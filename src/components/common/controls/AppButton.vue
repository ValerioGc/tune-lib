<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'neutral' | 'ghost' | 'danger';
    type?: 'button' | 'submit';
    disabled?: boolean;
  }>(),
  { variant: 'neutral', type: 'button', disabled: false },
);
</script>

<template>
  <button
    class="app_button"
    :class="{
      app_button_primary: variant === 'primary',
      app_button_neutral: variant === 'neutral',
      app_button_ghost: variant === 'ghost',
      app_button_danger: variant === 'danger',
    }"
    :type="type"
    :disabled="disabled"
    v-bind="$attrs"
  >
    <slot></slot>
  </button>
</template>

<style scoped lang="scss">
.app_button {
  @extend %inline_center;

  gap: $space_sm;
  min-height: 2rem;
  padding: $space_sm $space_md;
  border: 1px solid transparent;
  border-radius: $radius_md;
  font: inherit;
  cursor: pointer;
  transition:
    background-color $duration_fast ease,
    border-color $duration_fast ease,
    opacity $duration_fast ease;

  @include focus_ring;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &_primary {
    background-color: var(--color_accent);
    color: var(--color_on_accent);

    &:hover:not(:disabled) {
      background-color: var(--color_accent_hover);
    }
  }

  &_neutral {
    border-color: var(--color_border_strong);
    background-color: var(--color_surface);
    color: var(--color_text);

    &:hover:not(:disabled) {
      background-color: var(--color_surface_hover);
    }
  }

  &_ghost {
    background-color: transparent;
    color: var(--color_text_muted);

    &:hover:not(:disabled) {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }
  }

  &_danger {
    border-color: var(--color_danger_border);
    background-color: var(--color_surface);
    color: var(--color_danger);

    &:hover:not(:disabled) {
      border-color: var(--color_danger);
      background-color: var(--color_danger);
      color: var(--color_on_danger);
    }
  }
}
</style>
