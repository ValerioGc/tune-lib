import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useSettingsStore } from '@/stores/settings';
import { ACCENT_PRESETS, DEFAULT_ACCENT_COLOR } from '@/types/settings';

import AccentColorPicker from '@/components/settings/sections/AccentColorPicker.vue';

beforeEach(() => {
  resetI18n();
});

describe('AccentColorPicker', () => {
  it('offers one swatch per preset', () => {
    const wrapper = mount(AccentColorPicker, withPinia());

    expect(wrapper.findAll('.accent_picker_swatch')).toHaveLength(ACCENT_PRESETS.length);
  });

  it('marks the accent in use', () => {
    const wrapper = mount(AccentColorPicker, withPinia());
    const swatch = wrapper.get(`[data-testid="accent-${DEFAULT_ACCENT_COLOR.slice(1)}"]`);

    expect(swatch.attributes('aria-pressed')).toBe('true');
    expect(swatch.classes()).toContain('accent_picker_swatch_selected');
  });

  it('stores the colour of the chosen swatch', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const wrapper = mount(AccentColorPicker, options);

    await wrapper.get('[data-testid="accent-107c10"]').trigger('click');

    expect(settings.accentColor).toBe('#107c10');
  });

  it('accepts a colour from the free field', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const wrapper = mount(AccentColorPicker, options);

    await wrapper.get('[data-testid="accent-custom"]').setValue('#123456');

    expect(settings.accentColor).toBe('#123456');
  });

  it('returns to blue and disables the command once there', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    await settings.setAccentColor('#e3008c');
    const wrapper = mount(AccentColorPicker, options);

    const reset = wrapper.get('[data-testid="accent-reset"]');
    expect(reset.attributes('disabled')).toBeUndefined();

    await reset.trigger('click');

    expect(settings.accentColor).toBe(DEFAULT_ACCENT_COLOR);
    expect(wrapper.get('[data-testid="accent-reset"]').attributes('disabled')).toBeDefined();
  });

  it('shows the colour in use next to the free field', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    await settings.setAccentColor('#123456');
    const wrapper = mount(AccentColorPicker, options);

    expect(wrapper.get('.accent_picker_value').text()).toBe('#123456'.toUpperCase());
    expect(wrapper.get('.accent_picker_custom').classes()).toContain(
      'accent_picker_custom_selected',
    );
  });
});
