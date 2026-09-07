import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import * as defaultPlayer from '@/services/default-player';
import { useSettingsStore } from '@/stores/settings';

import DefaultPlayerBanner from '@/components/library/messages/DefaultPlayerBanner.vue';

enableAutoUnmount(afterEach);

beforeEach(() => {
  resetI18n();
  vi.restoreAllMocks();
  vi.spyOn(defaultPlayer, 'isDefaultAudioPlayer').mockResolvedValue(false);
});

describe('DefaultPlayerBanner', () => {
  it('opens default app settings from the action button', async () => {
    const openSettings = vi
      .spyOn(defaultPlayer, 'openDefaultAudioPlayerSettings')
      .mockResolvedValue(true);
    const wrapper = mount(DefaultPlayerBanner, withPinia());
    await flushPromises();

    await wrapper.get('.default_player_banner_actions button').trigger('click');

    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('dismisses the banner through settings', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const dismiss = vi.spyOn(settings, 'dismissDefaultPlayerBanner').mockResolvedValue();
    const wrapper = mount(DefaultPlayerBanner, options);
    await flushPromises();

    await wrapper.get('.default_player_banner_close').trigger('click');

    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('shows an error when system settings cannot be opened', async () => {
    vi.spyOn(defaultPlayer, 'openDefaultAudioPlayerSettings').mockResolvedValue(false);
    const wrapper = mount(DefaultPlayerBanner, withPinia());
    await flushPromises();

    await wrapper.get('.default_player_banner_actions button').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Errore durante l’apertura delle impostazioni di sistema.');
  });

  it('does not flash the banner while checking an existing association', async () => {
    vi.mocked(defaultPlayer.isDefaultAudioPlayer).mockResolvedValue(true);
    const wrapper = mount(DefaultPlayerBanner, withPinia());
    expect(wrapper.find('section').exists()).toBe(false);
    await flushPromises();
    expect(wrapper.find('section').exists()).toBe(false);
    expect(useSettingsStore().defaultPlayerBannerDismissed).toBe(false);
  });

  it('refreshes on focus and can show the banner again if defaults change', async () => {
    const detect = vi.mocked(defaultPlayer.isDefaultAudioPlayer);
    const wrapper = mount(DefaultPlayerBanner, withPinia());
    await flushPromises();
    expect(wrapper.find('section').exists()).toBe(true);

    detect.mockResolvedValue(true);
    window.dispatchEvent(new Event('focus'));
    await flushPromises();
    expect(wrapper.find('section').exists()).toBe(false);

    detect.mockResolvedValue(false);
    window.dispatchEvent(new Event('focus'));
    await flushPromises();
    expect(wrapper.find('section').exists()).toBe(true);

    wrapper.unmount();
    detect.mockClear();
    window.dispatchEvent(new Event('focus'));
    expect(detect).not.toHaveBeenCalled();
  });

  it('ignores an older check that completes after the latest one', async () => {
    let resolveFirst: (value: boolean) => void = () => {};
    vi.mocked(defaultPlayer.isDefaultAudioPlayer)
      .mockReturnValueOnce(
        new Promise<boolean>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValue(true);
    const wrapper = mount(DefaultPlayerBanner, withPinia());
    window.dispatchEvent(new Event('focus'));
    await flushPromises();
    resolveFirst(false);
    await flushPromises();
    expect(wrapper.find('section').exists()).toBe(false);
  });

  it('keeps the manual dismissal available when detection is unsupported', async () => {
    vi.mocked(defaultPlayer.isDefaultAudioPlayer).mockResolvedValue(null);
    const wrapper = mount(DefaultPlayerBanner, withPinia());
    await flushPromises();
    expect(wrapper.find('.default_player_banner_close').exists()).toBe(true);
  });
});
