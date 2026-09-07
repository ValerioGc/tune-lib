import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import flagDe from '@/assets/icons/flag-de.svg';
import flagEs from '@/assets/icons/flag-es.svg';
import flagFr from '@/assets/icons/flag-fr.svg';
import flagGb from '@/assets/icons/flag-gb.svg';
import flagIt from '@/assets/icons/flag-it.svg';
import { useSettingsStore } from '@/stores/settings';

import LanguageSelect from '@/components/settings/sections/LanguageSelect.vue';

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  localStorage.clear();
});

describe('LanguageSelect', () => {
  it('names every language in that language, not in the current one', () => {
    const wrapper = mount(LanguageSelect, withPinia());

    const labels = wrapper.findAll('.app_option_group_text').map((text) => text.text());

    expect(labels).toEqual(['Italiano', 'English', 'Français', 'Español', 'Deutsch']);
  });

  it('shows the flag of each language before its name', () => {
    const wrapper = mount(LanguageSelect, withPinia());
    const flags = wrapper.findAll('.app_option_group_icon');

    // Vite inlines small SVGs as data URIs, so the mapping is checked against the assets
    // themselves rather than against a file name that does not survive the build.
    const expected = [flagIt, flagGb, flagFr, flagEs, flagDe];

    expect(flags.map((flag) => flag.attributes('src'))).toEqual(expected);
    // One flag per language, none of them shared by two.
    expect(new Set(expected).size).toBe(expected.length);
    // The name beside it already says which language this is.
    expect(flags[0]?.attributes('alt')).toBe('');
  });

  it('reflects the current store language', async () => {
    const wrapper = mount(LanguageSelect, withPinia());
    const store = useSettingsStore();

    await store.setLocale('en');
    await wrapper.vm.$nextTick();

    const inputs = wrapper.findAll<HTMLInputElement>('input[type="radio"]');

    expect(inputs[1]?.element.checked).toBe(true);
    expect(wrapper.findAll('.app_option_group_item')[1]?.classes()).toContain(
      'app_option_group_item_selected',
    );
  });

  it('updates the store on selection', async () => {
    const wrapper = mount(LanguageSelect, withPinia());
    const store = useSettingsStore();

    await wrapper.findAll('input[type="radio"]')[1]?.setValue(true);

    expect(store.locale).toBe('en');
  });
});
