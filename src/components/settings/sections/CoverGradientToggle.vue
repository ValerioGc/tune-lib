<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppOptionGroup from '@/components/common/input/AppOptionGroup.vue';
import AppSelect from '@/components/common/input/AppSelect.vue';
import { useSettingsStore } from '@/stores/settings';
import {
  AMBIENT_DIRECTIONS,
  AMBIENT_STYLES,
  MAX_COVER_GRADIENT_INTENSITY,
  MAX_PLAYER_BLUR,
  type AmbientDirection,
  type AmbientStyle,
} from '@/types/settings';

const { t } = useI18n();
const settings = useSettingsStore();

// The shape and the origin come from the same vocabulary as the app background: the two
// gradients are the same idea, one taken from the accent and one from the cover.
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
const blurPercent = computed(() => Math.round((settings.playerBlur / MAX_PLAYER_BLUR) * 100));

/** The sliders tune the background taken from the cover: without it they have no subject. */
const isDisabled = computed(() => !settings.coverGradientEnabled);

async function onChange(event: Event) {
  await settings.setCoverGradientEnabled((event.target as HTMLInputElement).checked);
}

async function onTransparencyChange(event: Event) {
  await settings.setPlayerTransparency(Number((event.target as HTMLInputElement).value));
}

async function onBlurChange(event: Event) {
  const percentage = Number((event.target as HTMLInputElement).value);
  await settings.setPlayerBlur((percentage / 100) * MAX_PLAYER_BLUR);
}

async function onStyleChange(value: string) {
  await settings.setCoverGradientStyle(value as AmbientStyle);
}

async function onDirectionChange(value: string) {
  await settings.setCoverGradientDirection(value as AmbientDirection);
}

async function onIntensityChange(event: Event) {
  await settings.setCoverGradientIntensity(Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="cover_gradient_toggle">
    <label class="cover_gradient_toggle_check common_check">
      <input
        type="checkbox"
        :checked="settings.coverGradientEnabled"
        data-testid="cover-gradient-toggle"
        @change="onChange"
      />
      <span>{{ t('settings.coverGradient.toggle') }}</span>
    </label>

    <!-- The shape and the origin only mean something while the gradient is drawn. -->
    <template v-if="settings.coverGradientEnabled">
      <AppOptionGroup
        :model-value="settings.coverGradientStyle"
        :options="styleOptions"
        :legend="t('settings.coverGradient.style')"
        data-testid="cover-gradient-style"
        @update:model-value="onStyleChange"
      />

      <AppSelect
        class="cover_gradient_toggle_direction"
        :model-value="settings.coverGradientDirection"
        :options="directionOptions"
        :label="t('settings.coverGradient.direction')"
        data-testid="cover-gradient-direction"
        @update:model-value="onDirectionChange"
      />
    </template>

    <!-- What the gradient is, above; how strong it is, below. -->
    <hr class="cover_gradient_toggle_separator" />

    <label
      class="cover_gradient_toggle_slider"
      :class="{ cover_gradient_toggle_slider_disabled: isDisabled }"
    >
      <span>{{ t('settings.coverGradient.transparency') }}</span>
      <input
        type="range"
        min="0"
        max="45"
        step="1"
        :value="settings.playerTransparency"
        :disabled="isDisabled"
        data-testid="player-transparency"
        @input="onTransparencyChange"
      />
      <strong>{{ settings.playerTransparency }}%</strong>
    </label>

    <label
      class="cover_gradient_toggle_slider"
      :class="{ cover_gradient_toggle_slider_disabled: isDisabled }"
    >
      <span>{{ t('settings.coverGradient.intensity') }}</span>
      <input
        type="range"
        min="0"
        :max="MAX_COVER_GRADIENT_INTENSITY"
        step="1"
        :value="settings.coverGradientIntensity"
        :disabled="isDisabled"
        data-testid="cover-gradient-intensity"
        @input="onIntensityChange"
      />
      <strong>{{ settings.coverGradientIntensity }}%</strong>
    </label>

    <label
      class="cover_gradient_toggle_slider"
      :class="{ cover_gradient_toggle_slider_disabled: isDisabled }"
    >
      <span>{{ t('settings.coverGradient.blur') }}</span>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        :value="blurPercent"
        :disabled="isDisabled"
        data-testid="player-blur"
        @input="onBlurChange"
      />
      <strong>{{ blurPercent }}%</strong>
    </label>
  </div>
</template>

<style scoped lang="scss">
.cover_gradient_toggle {
  display: flex;
  flex-direction: column;
  gap: $space_md;
  align-items: flex-start;
  color: var(--color_text);

  &_separator {
    width: 100%;
    margin: $space_sm 0;
    border: 0;
    border-top: 1px solid var(--color_border);
  }

  &_slider {
    display: flex;
    gap: $space_md;
    align-items: center;
    width: min(32rem, 100%);
    transition: opacity $duration_fast ease;

    &_disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    span {
      min-width: 8rem;
      color: var(--color_text_muted);
      font-size: 0.875em;
    }

    input {
      flex: 1;
    }

    strong {
      min-width: 3rem;
      font-size: 0.875em;
      font-weight: 600;
      text-align: right;
    }
  }

  // The sliders of a gradient are dragged by eye: they are given room to be dragged in.
  input[type='range'] {
    height: 1.35rem;
    accent-color: var(--color_accent);

    &:disabled {
      cursor: not-allowed;
    }
  }
}
</style>
