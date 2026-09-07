import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useSettingsStore } from '@/stores/settings';
import { THEME_CHOICES } from '@/types/settings';

import ThemeSwitch from '@/components/settings/sections/ThemeSwitch.vue';

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  localStorage.clear();
});

describe('ThemeSwitch', () => {
  it('offre chiaro, scuro e sistema', () => {
    const wrapper = mount(ThemeSwitch, withPinia());

    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(THEME_CHOICES.length);
  });

  it('shows the detected theme only with the "system" choice', async () => {
    const wrapper = mount(ThemeSwitch, withPinia());
    const store = useSettingsStore();

    expect(wrapper.find('[data-testid="system-hint"]').exists()).toBe(true);

    await store.setTheme('dark');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="system-hint"]').exists()).toBe(false);
  });

  it('applies the chosen theme to the document', async () => {
    const wrapper = mount(ThemeSwitch, withPinia());
    const store = useSettingsStore();

    await wrapper.findAll('input[type="radio"]')[1]?.trigger('change');

    expect(store.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
