<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue';

import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/controls/AppTooltip.vue';
import type { IconName } from '@/config/icons';
import type { MenuItem } from '@/types/menu';

const props = withDefaults(
  defineProps<{
    items: readonly MenuItem[];
    label: string;
    icon?: IconName;
    hint?: string | undefined;
  }>(),
  { icon: 'more', hint: undefined },
);

const emit = defineEmits<{ select: [id: string] }>();

const isOpen = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);

function closeMenu() {
  isOpen.value = false;
}

async function openMenu() {
  isOpen.value = true;
  await nextTick();
  root.value?.querySelector<HTMLButtonElement>('.app_menu_item:not(:disabled)')?.focus();
}

async function toggleMenu() {
  if (isOpen.value) {
    closeMenu();
    return;
  }

  await openMenu();
}

function run(item: MenuItem) {
  if (item.disabled === true) {
    return;
  }

  emit('select', item.id);
  closeMenu();
}

async function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    await openMenu();
  }
}

function onDocumentPointerdown(event: PointerEvent) {
  if (root.value !== null && !root.value.contains(event.target as Node)) {
    closeMenu();
  }
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeMenu();
    trigger.value?.focus();
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

defineExpose({ close: closeMenu, open: openMenu });
</script>

<template>
  <div ref="root" class="app_menu">
    <AppTooltip :text="props.hint ?? props.label">
      <button
        ref="trigger"
        class="app_menu_trigger"
        type="button"
        :aria-label="props.label"
        :aria-expanded="isOpen"
        aria-haspopup="menu"
        @click="toggleMenu"
        @keydown="onTriggerKeydown"
      >
        <AppIcon :name="props.icon" />
      </button>
    </AppTooltip>

    <div v-if="isOpen" class="app_menu_panel common_surface" role="menu">
      <template v-for="item in props.items" :key="item.id">
        <hr v-if="item.divider === true" class="app_menu_divider" />
        <button
          class="app_menu_item"
          :class="{
            app_menu_item_danger: item.danger === true,
            app_menu_item_checked: item.checked === true,
          }"
          type="button"
          :role="item.checked === undefined ? 'menuitem' : 'menuitemradio'"
          :aria-checked="item.checked"
          :disabled="item.disabled === true"
          :aria-label="item.description"
          @click="run(item)"
        >
          <AppIcon v-if="item.icon !== undefined" :name="item.icon" />
          <span class="app_menu_item_label">{{ item.label }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app_menu {
  position: relative;
  display: flex;

  &_trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 0;
    border-radius: $radius_md;
    background-color: transparent;
    color: var(--color_text_muted);
    font: inherit;
    cursor: pointer;
    transition:
      background-color $duration_fast ease,
      color $duration_fast ease;

    &:hover,
    &[aria-expanded='true'] {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    @include focus_ring;
  }

  &_panel {
    position: absolute;
    top: calc(100% + #{$space_xs});
    right: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    min-width: 9rem;
    padding: $space_xs;
    box-shadow: var(--shadow_raised);
  }

  &_divider {
    height: 1px;
    margin: $space_xs 0;
    border: 0;
    background-color: var(--color_border);
  }

  &_item {
    display: flex;
    gap: $space_sm;
    align-items: center;
    min-height: 2rem;
    padding: $space_sm $space_md;
    border: 0;
    border-radius: $radius_sm;
    background: none;
    color: var(--color_text);
    font: inherit;
    text-align: left;
    white-space: nowrap;
    cursor: pointer;

    &:hover:not(:disabled) {
      background-color: var(--color_surface_hover);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &_danger {
      color: #c42b1c;
    }

    &_label {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &_checked {
      font-weight: 600;
    }

    @include focus_ring;
  }
}
</style>
