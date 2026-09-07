<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import { useLibraryStore } from '@/stores/library';

const { t } = useI18n();
const library = useLibraryStore();

const isOpen = ref(false);
const root = ref<HTMLElement | null>(null);

function close() {
  isOpen.value = false;
}

function toggle() {
  if (!library.isImporting) {
    isOpen.value = !isOpen.value;
  }
}

async function pickFiles() {
  close();
  await library.pickAndAdd();
}

async function pickFolder() {
  close();
  await library.pickFoldersAndAdd();
}

function onDocumentPointerdown(event: PointerEvent) {
  if (root.value !== null && !root.value.contains(event.target as Node)) {
    close();
  }
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close();
  }
}

watch(
  isOpen,
  (open) => {
    if (typeof document === 'undefined') {
      return;
    }

    if (open) {
      document.addEventListener('pointerdown', onDocumentPointerdown);
      document.addEventListener('keydown', onDocumentKeydown);
    } else {
      document.removeEventListener('pointerdown', onDocumentPointerdown);
      document.removeEventListener('keydown', onDocumentKeydown);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (typeof document === 'undefined') {
    return;
  }

  document.removeEventListener('pointerdown', onDocumentPointerdown);
  document.removeEventListener('keydown', onDocumentKeydown);
});
</script>

<template>
  <div ref="root" class="library_import_button">
    <button
      class="library_import_button_trigger"
      type="button"
      :disabled="library.isImporting"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      data-testid="library-import-open"
      @click="toggle"
    >
      <AppIcon name="add" />
      {{ library.isImporting ? t('library.toolbar.adding') : t('library.toolbar.add') }}
    </button>

    <div v-if="isOpen" class="library_import_button_menu common_surface" role="menu">
      <button class="library_import_button_item" type="button" role="menuitem" @click="pickFiles">
        <AppIcon name="note" />
        {{ t('library.toolbar.addFiles') }}
      </button>
      <button class="library_import_button_item" type="button" role="menuitem" @click="pickFolder">
        <AppIcon name="import" />
        {{ t('library.toolbar.addFolder') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.library_import_button {
  position: relative;
  display: flex;

  &_trigger,
  &_item {
    display: inline-flex;
    gap: $space_sm;
    align-items: center;
    min-height: 2rem;
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
  }

  &_trigger {
    padding: $space_sm $space_md;
    background-color: var(--color_accent);
    color: var(--color_on_accent);

    &:hover:not(:disabled),
    &[aria-expanded='true'] {
      background-color: var(--color_accent_hover);
    }
  }

  &_menu {
    position: absolute;
    top: calc(100% + #{$space_xs});
    left: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    min-width: 12rem;
    padding: $space_xs;
    box-shadow: var(--shadow_raised);
  }

  &_item {
    padding: $space_sm $space_md;
    background: none;
    color: var(--color_text);
    text-align: left;

    &:hover {
      background-color: var(--color_surface_hover);
    }
  }
}
</style>
