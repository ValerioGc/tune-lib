import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useSettingsStore } from '@/stores/settings';
import { TEXT_SIZES } from '@/types/settings';

import TextSizeSelect from '@/components/settings/sections/TextSizeSelect.vue';

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  localStorage.clear();
});

describe('TextSizeSelect', () => {
  it('offers one choice for each available size', () => {
    const wrapper = mount(TextSizeSelect, withPinia());

    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(TEXT_SIZES.length);
  });

  it('shows preview text', () => {
    const wrapper = mount(TextSizeSelect, withPinia());

    expect(wrapper.get('[data-testid="text-size-preview"]').text().length).toBeGreaterThan(0);
  });

  it('updates the store and document scale', async () => {
    const wrapper = mount(TextSizeSelect, withPinia());
    const store = useSettingsStore();

    await wrapper.findAll('input[type="radio"]')[3]?.trigger('change');

    expect(store.textSize).toBe('large');
    expect(document.documentElement.style.getPropertyValue('--app_font_scale')).toBe('1.125');
  });

  it('offers a step below small', async () => {
    const wrapper = mount(TextSizeSelect, withPinia());
    const store = useSettingsStore();

    await wrapper.findAll('input[type="radio"]')[0]?.trigger('change');

    expect(store.textSize).toBe('xsmall');
    expect(document.documentElement.style.getPropertyValue('--app_font_scale')).toBe('0.8125');
  });
});
