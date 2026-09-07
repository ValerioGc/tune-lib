<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppOptionGroup from '@/components/common/input/AppOptionGroup.vue';
import { useSettingsStore } from '@/stores/settings';
import { TEXT_SIZES, type TextSize } from '@/types/settings';

const { t } = useI18n();
const settings = useSettingsStore();

const options = computed(() =>
  TEXT_SIZES.map((size) => ({ value: size, label: t(`settings.textSize.options.${size}`) })),
);

async function onSelect(value: string) {
  await settings.setTextSize(value as TextSize);
}
</script>

<template>
  <div class="text_size_select">
    <AppOptionGroup
      :model-value="settings.textSize"
      :options="options"
      :legend="t('settings.textSize.title')"
      @update:model-value="onSelect"
    />
    <p class="text_size_select_preview" data-testid="text-size-preview">
      {{ t('settings.textSize.preview') }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.text_size_select {
  display: flex;
  flex-direction: column;
  gap: $space_md;

  &_preview {
    padding: $space_md;
    border: 1px dashed var(--color_border_strong);
    border-radius: $radius_md;
    color: var(--color_text_muted);
  }
}
</style>
