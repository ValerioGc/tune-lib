<script setup lang="ts">
defineProps<{
  title: string;
  message: string;
}>();
</script>

<template>
  <section class="app_placeholder">
    <h2 class="app_placeholder_title">{{ title }}</h2>
    <p class="app_placeholder_message">{{ message }}</p>
    <slot></slot>
  </section>
</template>

<style scoped lang="scss">
.app_placeholder {
  @extend %stack;

  flex: 1;
  gap: $space_sm;
  align-items: center;
  justify-content: center;
  padding: $space_xl;
  border: 1px dashed var(--color_border_strong);
  border-radius: $radius_lg;
  text-align: center;

  &_title {
    font-size: 1.25em;
    font-weight: 600;
  }

  &_message {
    color: var(--color_text_muted);
  }
}
</style>
