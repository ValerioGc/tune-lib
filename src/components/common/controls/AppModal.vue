<script setup lang="ts">
import { useId, watch } from 'vue';
import { useOverlay } from '@/composables/useForeground';

const props = defineProps<{
  open: boolean;
  title: string;
  wide?: boolean;
  glass?: boolean;
  contentScrolls?: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

const titleId = useId();

useOverlay(() => props.open);

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close');
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (typeof document === 'undefined') {
      return;
    }

    if (isOpen) {
      document.addEventListener('keydown', onKeydown);
    } else {
      document.removeEventListener('keydown', onKeydown);
    }
  },
  { immediate: true },
);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="app_modal" @click.self="emit('close')">
      <dialog
        open
        class="app_modal_panel common_surface_lg"
        :class="{
          app_modal_panel_wide: wide,
          app_modal_panel_glass: glass,
          common_glass_lg: glass,
        }"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <h2 :id="titleId" class="app_modal_title">{{ title }}</h2>
        <div class="app_modal_body" :class="{ app_modal_body_content_scrolls: contentScrolls }">
          <slot></slot>
        </div>
        <footer class="app_modal_actions">
          <slot name="actions"></slot>
        </footer>
      </dialog>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.app_modal {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $space_lg;
  background-color: rgb(0 0 0 / 40%);

  &_panel {
    position: static;
    display: flex;
    flex-direction: column;
    gap: $space_md;
    width: min(28rem, 100%);
    max-height: 100%;
    padding: $space_lg;
    margin: 0;
    color: var(--color_text);
    box-shadow: var(--shadow_raised);

    &_wide {
      width: min(62rem, 100%);
    }

    &_glass {
      box-shadow: var(--shadow_raised);
    }

    :root[data-ambient='on'][data-ambient-panels='on'] &_glass {
      background-image: var(--app_ambient_layers);
      background-repeat: no-repeat;
    }
  }

  &_title {
    font-size: 1.125em;
    font-weight: 600;
  }

  &_body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    color: var(--color_text_muted);

    &_content_scrolls {
      overflow: visible;
      scrollbar-gutter: auto;
    }
  }

  &_actions {
    display: flex;
    gap: $space_sm;
    justify-content: flex-end;
  }
}
</style>
