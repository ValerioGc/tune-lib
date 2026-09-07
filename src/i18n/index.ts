import { createI18n } from 'vue-i18n';

import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import it from '@/locales/it.json';
import deHelp from '@/locales/help/de.json';
import enHelp from '@/locales/help/en.json';
import esHelp from '@/locales/help/es.json';
import frHelp from '@/locales/help/fr.json';
import itHelp from '@/locales/help/it.json';
import { DEFAULT_SETTINGS, LOCALES, type Locale } from '@/types/settings';

const messages = {
  it: { ...it, help: itHelp },
  en: { ...en, help: enHelp },
  fr: { ...fr, help: frHelp },
  es: { ...es, help: esHelp },
  de: { ...de, help: deHelp },
};

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_SETTINGS.locale,
  fallbackLocale: DEFAULT_SETTINGS.locale,
  messages,
});

export function isSupportedLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Picks the first supported locale out of the browser preferences. */
export function detectLocale(preferences: readonly string[]): Locale {
  for (const preference of preferences) {
    const language = preference.split('-')[0]?.toLowerCase();

    if (isSupportedLocale(language)) {
      return language;
    }
  }

  return DEFAULT_SETTINGS.locale;
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return DEFAULT_SETTINGS.locale;
  }

  return detectLocale(navigator.languages ?? [navigator.language]);
}

export function setI18nLocale(locale: Locale) {
  i18n.global.locale.value = locale;
}
