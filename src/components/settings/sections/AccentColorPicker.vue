<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import { useSettingsStore } from '@/stores/settings';
import { ACCENT_PRESETS, DEFAULT_ACCENT_COLOR } from '@/types/settings';

const { t } = useI18n();
const settings = useSettingsStore();

const swatches = computed(() =>
  ACCENT_PRESETS.map((color) => ({
    color,
    selected: color.toLowerCase() === settings.accentColor.toLowerCase(),
  })),
);

const isCustom = computed(
  () => !ACCENT_PRESETS.some((color) => color.toLowerCase() === settings.accentColor.toLowerCase()),
);

const isDefault = computed(
  () => settings.accentColor.toLowerCase() === DEFAULT_ACCENT_COLOR.toLowerCase(),
);

async function select(color: string) {
  await settings.setAccentColor(color);
}

async function onCustomInput(event: Event) {
  await settings.setAccentColor((event.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="accent_picker">
    <fieldset class="accent_picker_swatches">
      <legend class="accent_picker_swatches_label common_visually_hidden">
        {{ t('settings.accent.title') }}
      </legend>
      <button
        v-for="swatch in swatches"
        :key="swatch.color"
        class="accent_picker_swatch"
        :class="{ accent_picker_swatch_selected: swatch.selected }"
        type="button"
        :style="{ '--accent_picker_color': swatch.color }"
        :aria-pressed="swatch.selected"
        :aria-label="t('settings.accent.swatch', { color: swatch.color })"
        :title="swatch.color"
        :data-testid="`accent-${swatch.color.slice(1)}`"
        @click="select(swatch.color)"
      >
        <AppIcon v-if="swatch.selected" name="check" />
      </button>
    </fieldset>

    <div class="accent_picker_row">
      <label
        class="accent_picker_custom common_surface"
        :class="{ accent_picker_custom_selected: isCustom }"
        :style="{ '--accent_picker_color': settings.accentColor }"
      >
        <input
          class="accent_picker_field"
          type="color"
          :value="settings.accentColor"
          data-testid="accent-custom"
          @input="onCustomInput"
        />
        <span>{{ t('settings.accent.custom') }}</span>
        <code class="accent_picker_value">{{ settings.accentColor.toUpperCase() }}</code>
      </label>

      <AppButton
        variant="ghost"
        :disabled="isDefault"
        data-testid="accent-reset"
        @click="settings.resetAccentColor()"
      >
        <AppIcon name="back" />
        {{ t('settings.accent.reset') }}
      </AppButton>
    </div>

    <p class="accent_picker_hint">{{ t('settings.accent.hint') }}</p>
  </div>
</template>

<style scoped lang="scss">
.accent_picker {
  display: flex;
  flex-direction: column;
  gap: $space_md;

  &_swatches {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(2.25rem, 2.5rem));
    gap: $space_sm;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  &_swatch {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    width: 100%;
    border: 1px solid rgb(0 0 0 / 15%);
    border-radius: $radius_md;
    background-color: var(--accent_picker_color);
    color: #ffffff;
    cursor: pointer;
    transition:
      transform $duration_fast ease,
      box-shadow $duration_fast ease;

    &:hover {
      transform: scale(1.06);
    }

    @include focus_ring;

    // The ring is drawn on the page background so it reads on any swatch colour.
    &_selected {
      box-shadow:
        0 0 0 2px var(--color_bg),
        0 0 0 4px var(--accent_picker_color);
    }
  }

  &_row {
    display: flex;
    flex-wrap: wrap;
    gap: $space_sm;
    align-items: center;
  }

  &_custom {
    display: inline-flex;
    gap: $space_sm;
    align-items: center;
    padding: $space_xs $space_sm;
    cursor: pointer;

    &_selected {
      border-color: var(--accent_picker_color);
    }
  }

  &_field {
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_sm;
    background: none;
    cursor: pointer;
  }

  &_value {
    color: var(--color_text_muted);
    font-family: ui-monospace, 'Cascadia Mono', monospace;
    font-size: 0.8em;
    font-variant-numeric: tabular-nums;
  }

  &_hint {
    color: var(--color_text_muted);
    font-size: 0.875em;
  }
}
</style>
