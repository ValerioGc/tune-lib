import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import * as defaultPlayer from '@/services/default-player';
import * as platform from '@/services/platform';

import DefaultPlayerPanel from '@/components/settings/sections/DefaultPlayerPanel.vue';

beforeEach(() => {
  resetI18n();
  vi.restoreAllMocks();
  // The panel is drawn for the system it runs on: the tests say which one that is.
  vi.spyOn(platform, 'currentPlatform').mockReturnValue('windows');
});

describe('DefaultPlayerPanel', () => {
  it('opens default app settings', async () => {
    const openSettings = vi
      .spyOn(defaultPlayer, 'openDefaultAudioPlayerSettings')
      .mockResolvedValue(true);
    const wrapper = mount(DefaultPlayerPanel, withPinia());

    await wrapper.get('button').trigger('click');

    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('shows an error when system settings cannot be opened', async () => {
    vi.spyOn(defaultPlayer, 'openDefaultAudioPlayerSettings').mockResolvedValue(false);
    const wrapper = mount(DefaultPlayerPanel, withPinia());

    await wrapper.get('button').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Errore durante l’apertura delle impostazioni di sistema.',
    );
  });

  it('writes out the way to the association on Linux, where no page can be opened', () => {
    vi.spyOn(platform, 'currentPlatform').mockReturnValue('linux');
    const wrapper = mount(DefaultPlayerPanel, withPinia());

    expect(wrapper.get('[data-testid="default-player-linux"]').text()).toContain(
      'ambiente desktop',
    );
    expect(wrapper.get('.default_player_panel_command').text()).toContain('xdg-mime default');
    // There is no settings page to send anyone to: the button would lead nowhere.
    expect(wrapper.find('[data-testid="default-player-open"]').exists()).toBe(false);
  });
});
