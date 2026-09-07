<script setup lang="ts">
import { computed, ref, useId } from 'vue';

export interface SettingsTab {
  id: string;
  label: string;
}

const props = defineProps<{ tabs: readonly SettingsTab[] }>();

const baseId = useId();
const activeId = ref(props.tabs[0]?.id ?? '');

const active = computed(() => props.tabs.find((tab) => tab.id === activeId.value) ?? null);

function tabId(id: string) {
  return `${baseId}-tab-${id}`;
}

function panelId(id: string) {
  return `${baseId}-panel-${id}`;
}

function select(id: string) {
  activeId.value = id;
}

const ARROW_STEPS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

function onKeydown(event: KeyboardEvent, index: number) {
  const step = ARROW_STEPS[event.key];

  if (step === undefined) {
    return;
  }

  event.preventDefault();
  const next = props.tabs[(index + step + props.tabs.length) % props.tabs.length];

  if (next !== undefined) {
    select(next.id);
  }
}
</script>

<template>
  <div class="settings_tabs">
    <div class="settings_tabs_list" role="tablist">
      <button
        v-for="(tab, index) in tabs"
        :id="tabId(tab.id)"
        :key="tab.id"
        class="settings_tabs_tab"
        :class="{ settings_tabs_tab_active: tab.id === activeId }"
        type="button"
        role="tab"
        :aria-selected="tab.id === activeId"
        :aria-controls="panelId(tab.id)"
        :tabindex="tab.id === activeId ? 0 : -1"
        @click="select(tab.id)"
        @keydown="onKeydown($event, index)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div
      v-if="active !== null"
      :id="panelId(active.id)"
      class="settings_tabs_panel common_scroll_area"
      role="tabpanel"
      :aria-labelledby="tabId(active.id)"
    >
      <slot :name="active.id" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings_tabs {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $space_lg;
  min-height: 0;

  &_list {
    display: flex;
    gap: $space_xs;
    // Centred: the settings are read down the middle of the page, and the strip that names
    // the sections belongs on the same axis as they do.
    justify-content: center;
    padding: $space_xs;

    @include page_column(var(--settings_column));
    border: 1px solid var(--color_border);
    border-radius: $radius_lg;
    background-color: var(--color_surface_alt);
  }

  // The sections are what scrolls: the tabs above them stay where they were pressed.
  //
  // As wide as the window, so the wheel turns anywhere over the page and the scrollbar sits
  // at the edge of the window rather than against the sections. What is inside keeps to the
  // column, which is what the reader sees.
  &_panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  &_tab {
    padding: $space_sm $space_lg;
    border: 0;
    border-radius: $radius_md;
    background: none;
    color: var(--color_text_muted);
    font: inherit;
    cursor: pointer;
    transition:
      background-color $duration_fast ease,
      color $duration_fast ease;

    &:hover {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    @include focus_ring;

    &_active {
      background-color: var(--color_accent);
      color: var(--color_on_accent);

      &:hover {
        background-color: var(--color_accent_hover);
        color: var(--color_on_accent);
      }
    }
  }
}
</style>
