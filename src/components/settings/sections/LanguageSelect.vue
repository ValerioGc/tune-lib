<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppOptionGroup from '@/components/common/input/AppOptionGroup.vue';
import flagDe from '@/assets/icons/flag-de.svg';
import flagEs from '@/assets/icons/flag-es.svg';
import flagFr from '@/assets/icons/flag-fr.svg';
import flagGb from '@/assets/icons/flag-gb.svg';
import flagIt from '@/assets/icons/flag-it.svg';
import { useSettingsStore } from '@/stores/settings';
import { LOCALES, type Locale } from '@/types/settings';

/**
 * Each language names itself, whatever the interface is set to: a reader looking for their
 * own language recognises `Deutsch`, not its translation.
 */
const LANGUAGE_NAMES: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
};

/** The same flags the GitHub Pages site uses for its language switcher. */
const FLAGS: Record<Locale, string> = {
  it: flagIt,
  en: flagGb,
  fr: flagFr,
  es: flagEs,
  de: flagDe,
};

const { t } = useI18n();
const settings = useSettingsStore();

const options = computed(() =>
  LOCALES.map((locale) => ({
    value: locale,
    label: LANGUAGE_NAMES[locale],
    icon: FLAGS[locale],
  })),
);

async function onSelect(value: string) {
  await settings.setLocale(value as Locale);
}
</script>

<template>
  <!-- A group rather than a dropdown: a native option cannot carry the flag beside its
       label, and with a handful of languages every choice is visible at once. -->
  <AppOptionGroup
    :model-value="settings.locale"
    :options="options"
    :legend="t('settings.language.title')"
    @update:model-value="onSelect"
  />
</template>
