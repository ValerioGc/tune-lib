import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useSettingsStore } from '@/stores/settings';

import PlayerBehaviourPanel from '@/components/settings/sections/PlayerBehaviourPanel.vue';

beforeEach(() => {
  resetI18n();
});

describe('PlayerBehaviourPanel', () => {
  it('keeps the player on screen after the track is closed', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const wrapper = mount(PlayerBehaviourPanel, options);

    await wrapper.get('[data-testid="keep-player-open-toggle"]').setValue(true);

    expect(settings.keepPlayerOpen).toBe(true);
  });
});
