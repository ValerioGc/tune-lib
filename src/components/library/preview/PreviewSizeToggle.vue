<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppTooltip from '@/components/common/controls/AppTooltip.vue';
import { useSettingsStore } from '@/stores/settings';
import { PREVIEW_SIZES, type PreviewSize, type PreviewSizePage } from '@/types/settings';

const props = withDefaults(defineProps<{ page: PreviewSizePage; disabled?: boolean }>(), {
  disabled: false,
});

const { t } = useI18n();
const settings = useSettingsStore();

/**
 * A square per size, growing left to right.
 *
 * Drawn rather than lettered: three squares say what three cards will look like without
 * asking anyone to read, and they say it the same way in every language.
 */
const options = computed(() =>
  PREVIEW_SIZES.map((size) => ({
    size,
    label: t(`library.previewSize.${size}`),
    active: settings.previewSizes[props.page] === size,
  })),
);

function setSize(size: PreviewSize) {
  settings.setPreviewSize(props.page, size);
}
</script>

<template>
  <fieldset class="preview_size_toggle">
    <legend class="preview_size_toggle_label common_visually_hidden">
      {{ t('library.previewSize.label') }}
    </legend>
    <AppTooltip
      v-for="option in options"
      :key="option.size"
      :text="option.label"
      :disabled="disabled"
    >
      <AppButton
        variant="ghost"
        :disabled="disabled"
        :class="{ preview_size_toggle_active: option.active }"
        :aria-label="option.label"
        :aria-pressed="option.active"
        :data-testid="`preview-size-${option.size}`"
        @click="setSize(option.size)"
      >
        <span
          class="preview_size_toggle_mark"
          :class="{
            preview_size_toggle_mark_small: option.size === 'small',
            preview_size_toggle_mark_medium: option.size === 'medium',
            preview_size_toggle_mark_large: option.size === 'large',
          }"
          aria-hidden="true"
        />
      </AppButton>
    </AppTooltip>
  </fieldset>
</template>

<style scoped lang="scss">
.preview_size_toggle {
  display: flex;
  gap: $space_xs;
  padding: $space_xs;
  border: 1px solid var(--color_border);
  border-radius: $radius_lg;
  background-color: var(--color_surface_alt);

  // The square is centred in the space of the largest, so the three buttons keep one width
  // and the row does not shift as the choice moves along it.
  &_mark {
    display: block;
    width: 1rem;
    height: 1rem;
    border: 2px solid currentcolor;
    border-radius: $radius_sm;

    &_small {
      width: 0.6rem;
      height: 0.6rem;
      margin: 0.2rem;
    }

    &_medium {
      width: 0.8rem;
      height: 0.8rem;
      margin: 0.1rem;
    }
  }

  &_active {
    background-color: var(--color_accent);
    color: var(--color_on_accent);

    &:hover:not(:disabled) {
      background-color: var(--color_accent_hover);
    }
  }
}
</style>
