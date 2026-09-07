import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useSettingsStore } from '@/stores/settings';

import StartupPanel from '@/components/settings/sections/StartupPanel.vue';

beforeEach(() => {
  resetI18n();
  vi.restoreAllMocks();
});

function mountPanel() {
  const options = withPinia();
  const settings = useSettingsStore();

  return { wrapper: mount(StartupPanel, options), settings };
}

describe('StartupPanel', () => {
  it('registers the app with the system and remembers the choice', async () => {
    const { wrapper, settings } = mountPanel();

    await wrapper.get('[data-testid="autostart-toggle"]').setValue(true);

    expect(settings.autostartEnabled).toBe(true);
  });

  it('keeps starting minimized out of reach until the app starts on its own', async () => {
    const { wrapper, settings } = mountPanel();
    const minimized = wrapper.get('[data-testid="autostart-minimized-toggle"]');

    expect(minimized.attributes('disabled')).toBeDefined();

    await wrapper.get('[data-testid="autostart-toggle"]').setValue(true);

    expect(
      wrapper.get('[data-testid="autostart-minimized-toggle"]').attributes('disabled'),
    ).toBeUndefined();

    await wrapper.get('[data-testid="autostart-minimized-toggle"]').setValue(true);

    expect(settings.autostartMinimized).toBe(true);
  });

  it('leaves the app in the tray when the window is closed', async () => {
    const { wrapper, settings } = mountPanel();

    await wrapper.get('[data-testid="close-to-tray-toggle"]').setValue(true);

    expect(settings.closeToTray).toBe(true);
  });
});
