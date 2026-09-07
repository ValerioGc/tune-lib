<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppSelect from '@/components/common/input/AppSelect.vue';
import { useSettingsStore } from '@/stores/settings';
import { BANNER_DURATIONS, type BannerDuration } from '@/types/settings';
import type { SelectOption } from '@/types/ui';

const { t } = useI18n();
const settings = useSettingsStore();

/** Zero is the one entry that is not a length: it says the message waits to be closed. */
const options = computed<SelectOption[]>(() =>
  BANNER_DURATIONS.map((seconds) => ({
    value: String(seconds),
    label:
      seconds === 0
        ? t('settings.banners.manual')
        : t('settings.banners.seconds', { count: seconds }),
  })),
);

const duration = computed({
  get: () => String(settings.bannerDuration),
  set: (value: string) => {
    settings.setBannerDuration(Number(value) as BannerDuration);
  },
});
</script>

<template>
  <AppSelect
    v-model="duration"
    :label="t('settings.banners.duration')"
    :options="options"
    data-testid="banner-duration"
  />
</template>
