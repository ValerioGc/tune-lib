<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppOptionGroup from '@/components/common/input/AppOptionGroup.vue';
import { useSettingsStore } from '@/stores/settings';
import { THEME_CHOICES, type ThemeChoice } from '@/types/settings';

const { t } = useI18n();
const settings = useSettingsStore();

const options = computed(() =>
  THEME_CHOICES.map((choice) => ({
    value: choice,
    label: t(`settings.theme.options.${choice}`),
  })),
);

const systemHint = computed(() =>
  t('settings.theme.systemHint', {
    theme: t(`settings.theme.options.${settings.systemTheme}`).toLowerCase(),
  }),
);

async function onSelect(value: string) {
  await settings.setTheme(value as ThemeChoice);
}
</script>

<template>
  <div class="theme_switch">
    <AppOptionGroup
      :model-value="settings.theme"
      :options="options"
      :legend="t('settings.theme.title')"
      @update:model-value="onSelect"
    />
    <p v-if="settings.theme === 'system'" class="theme_switch_hint" data-testid="system-hint">
      {{ systemHint }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.theme_switch {
  display: flex;
  flex-direction: column;
  gap: $space_sm;

  &_hint {
    color: var(--color_text_muted);
    font-size: 0.875em;
  }
}
</style>
