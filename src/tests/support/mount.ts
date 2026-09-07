import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { i18n } from '@/i18n';
import { DEFAULT_SETTINGS } from '@/types/settings';

export function createTestPinia(): Pinia {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

/** Restores the shared i18n instance between tests. */
export function resetI18n() {
  i18n.global.locale.value = DEFAULT_SETTINGS.locale;
}

export function withPinia() {
  return { global: { plugins: [createTestPinia(), i18n] } };
}
