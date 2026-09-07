<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppOptionGroup from '@/components/common/input/AppOptionGroup.vue';
import AppSelect from '@/components/common/input/AppSelect.vue';
import { ambience } from '@/services/ambience';
import { useSettingsStore } from '@/stores/settings';
import {
  AMBIENT_DIRECTIONS,
  AMBIENT_STYLES,
  type AmbientDirection,
  type AmbientStyle,
} from '@/types/settings';

const { t } = useI18n();
const settings = useSettingsStore();

/** The preview shows exactly what the window will get, options included. */
const previewStyle = computed(() => ({
  backgroundImage: ambience(
    settings.accentColor,
    settings.resolvedTheme,
    settings.ambientStyle,
    settings.ambientDirection,
  ).layers,
}));

const styleOptions = computed(() =>
  AMBIENT_STYLES.map((style) => ({
    value: style,
    label: t(`settings.ambience.styles.${style}`),
  })),
);

const directionOptions = computed(() =>
  AMBIENT_DIRECTIONS.map((direction) => ({
    value: direction,
    label: t(`settings.ambience.directions.${direction}`),
  })),
);

async function onBackgroundChange(event: Event) {
  await settings.setAmbientBackgroundEnabled((event.target as HTMLInputElement).checked);
}

async function onPanelsChange(event: Event) {
  await settings.setAmbientOnPanels((event.target as HTMLInputElement).checked);
}

async function onGlassChange(event: Event) {
  await settings.setGlassSurfacesEnabled((event.target as HTMLInputElement).checked);
}

async function onStyleChange(value: string) {
  await settings.setAmbientStyle(value as AmbientStyle);
}

async function onDirectionChange(value: string) {
  await settings.setAmbientDirection(value as AmbientDirection);
}
</script>

<template>
  <div class="ambience_toggle">
    <label class="ambience_toggle_check common_check">
      <input
        type="checkbox"
        :checked="settings.ambientBackgroundEnabled"
        data-testid="ambient-background-toggle"
        @change="onBackgroundChange"
      />
      <span>{{ t('settings.ambience.background') }}</span>
    </label>

    <!-- The shape and the origin only mean something while the background is drawn. -->
    <template v-if="settings.ambientBackgroundEnabled">
      <AppOptionGroup
        :model-value="settings.ambientStyle"
        :options="styleOptions"
        :legend="t('settings.ambience.style')"
        data-testid="ambient-style"
        @update:model-value="onStyleChange"
      />

      <AppSelect
        class="ambience_toggle_direction"
        :model-value="settings.ambientDirection"
        :options="directionOptions"
        :label="t('settings.ambience.direction')"
        data-testid="ambient-direction"
        @update:model-value="onDirectionChange"
      />

      <div class="ambience_toggle_preview" :style="previewStyle" data-testid="ambience-preview">
        <span class="ambience_toggle_preview_card common_glass">{{
          t('settings.ambience.preview')
        }}</span>
      </div>

      <label class="ambience_toggle_check common_check">
        <input
          type="checkbox"
          :checked="settings.ambientOnPanels"
          data-testid="ambient-panels-toggle"
          @change="onPanelsChange"
        />
        <span>{{ t('settings.ambience.panels') }}</span>
      </label>
    </template>

    <label class="ambience_toggle_check common_check">
      <input
        type="checkbox"
        :checked="settings.glassSurfacesEnabled"
        data-testid="glass-surfaces-toggle"
        @change="onGlassChange"
      />
      <span>{{ t('settings.ambience.glass') }}</span>
    </label>

    <p class="ambience_toggle_hint">{{ t('settings.ambience.hint') }}</p>
  </div>
</template>

<style scoped lang="scss">
.ambience_toggle {
  display: flex;
  flex-direction: column;
  gap: $space_md;

  &_direction {
    max-width: 16rem;
  }

  &_preview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 7rem;
    margin-top: $space_xs;
    border: 1px solid var(--color_border);
    border-radius: $radius_md;
    background-color: var(--color_bg);
    background-repeat: no-repeat;
    background-size: cover;

    &_card {
      padding: $space_sm $space_md;
      font-size: 0.8125em;
    }
  }

  &_hint {
    color: var(--color_text_muted);
    font-size: 0.875em;
  }
}
</style>
