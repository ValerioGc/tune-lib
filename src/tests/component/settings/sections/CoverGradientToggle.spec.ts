import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useSettingsStore } from '@/stores/settings';

import CoverGradientToggle from '@/components/settings/sections/CoverGradientToggle.vue';

beforeEach(() => {
  resetI18n();
});

describe('CoverGradientToggle', () => {
  it('shows the saved state', () => {
    const options = withPinia();
    const settings = useSettingsStore();
    settings.coverGradientEnabled = false;

    const wrapper = mount(CoverGradientToggle, options);

    expect((wrapper.get('input').element as HTMLInputElement).checked).toBe(false);
  });

  it('updates the setting', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const setCoverGradientEnabled = vi
      .spyOn(settings, 'setCoverGradientEnabled')
      .mockResolvedValue();

    const wrapper = mount(CoverGradientToggle, options);
    await wrapper.get('input').setValue(false);

    expect(setCoverGradientEnabled).toHaveBeenCalledWith(false);
  });

  it('leaves the sliders alive while the gradient is on', () => {
    const wrapper = mount(CoverGradientToggle, withPinia());

    for (const testid of ['player-transparency', 'cover-gradient-intensity', 'player-blur']) {
      expect(wrapper.get(`[data-testid="${testid}"]`).attributes('disabled')).toBeUndefined();
    }

    expect(wrapper.get('[data-testid="cover-gradient-intensity"]').attributes('min')).toBe('0');
    expect(wrapper.get('[data-testid="cover-gradient-intensity"]').attributes('max')).toBe('150');
    expect(wrapper.find('.cover_gradient_toggle_slider_disabled').exists()).toBe(false);
  });

  it('disables the sliders, and says so, once the gradient is off', () => {
    const options = withPinia();
    useSettingsStore().coverGradientEnabled = false;

    const wrapper = mount(CoverGradientToggle, options);

    for (const testid of ['player-transparency', 'cover-gradient-intensity', 'player-blur']) {
      expect(wrapper.get(`[data-testid="${testid}"]`).attributes('disabled')).toBeDefined();
    }
    expect(wrapper.findAll('.cover_gradient_toggle_slider_disabled')).toHaveLength(3);
  });

  it('follows the checkbox without being remounted', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    vi.spyOn(settings, 'setCoverGradientEnabled').mockImplementation(async (next: boolean) => {
      settings.coverGradientEnabled = next;
    });

    const wrapper = mount(CoverGradientToggle, options);
    await wrapper.get('[data-testid="cover-gradient-toggle"]').setValue(false);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="player-blur"]').attributes('disabled')).toBeDefined();
  });

  it('updates player transparency, gradient intensity and blur percentage', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const setPlayerTransparency = vi.spyOn(settings, 'setPlayerTransparency').mockResolvedValue();
    const setCoverGradientIntensity = vi
      .spyOn(settings, 'setCoverGradientIntensity')
      .mockResolvedValue();
    const setPlayerBlur = vi.spyOn(settings, 'setPlayerBlur').mockResolvedValue();

    const wrapper = mount(CoverGradientToggle, options);
    await wrapper.get('[data-testid="player-transparency"]').setValue(30);
    await wrapper.get('[data-testid="cover-gradient-intensity"]').setValue(150);
    await wrapper.get('[data-testid="player-blur"]').setValue(50);

    expect(setPlayerTransparency).toHaveBeenCalledWith(30);
    expect(setCoverGradientIntensity).toHaveBeenCalledWith(150);
    expect(setPlayerBlur).toHaveBeenCalledWith(14);
  });

  it('offers the shape and the origin of the gradient, as the background does', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const wrapper = mount(CoverGradientToggle, options);

    await wrapper.get('[data-testid="cover-gradient-style"] input[value="linear"]').setValue(true);
    await wrapper.get('[data-testid="cover-gradient-direction"] select').setValue('bottomRight');

    expect(settings.coverGradientStyle).toBe('linear');
    expect(settings.coverGradientDirection).toBe('bottomRight');
  });

  it('hides shape and origin while the gradient is off', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const wrapper = mount(CoverGradientToggle, options);

    settings.coverGradientEnabled = false;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="cover-gradient-style"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="cover-gradient-direction"]').exists()).toBe(false);
  });
});
