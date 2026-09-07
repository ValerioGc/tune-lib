import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import * as bridge from '@/services/mini-player-bridge';
import * as shell from '@/services/shell-integration';
import * as windowControls from '@/services/window-controls';

import MiniConfirmView from '@/views/MiniConfirmView.vue';
import confirmationCapability from '../../../../src-tauri/capabilities/mini-confirm.json';

enableAutoUnmount(afterEach);

beforeEach(() => {
  resetI18n();
  vi.restoreAllMocks();
});

describe('MiniConfirmView', () => {
  it('shows and focuses the confirmation even when hidden-window animation frames are paused', async () => {
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    const show = vi.spyOn(windowControls, 'showCurrentWindow').mockResolvedValue(true);
    mount(MiniConfirmView, withPinia());
    await flushPromises();

    expect(show).toHaveBeenCalledTimes(1);
    expect(frame).not.toHaveBeenCalled();
  });

  it('grants the confirmation window the native permissions needed to show and focus itself', () => {
    expect(confirmationCapability.windows).toEqual(['mini-confirm']);
    expect(confirmationCapability.permissions).toEqual(
      expect.arrayContaining(['core:window:allow-show', 'core:window:allow-set-focus']),
    );
  });

  it('closes the dock directly when that choice is confirmed', async () => {
    const closeDock = vi.spyOn(shell, 'closeMiniPlayer').mockResolvedValue(true);
    const closeConfirmation = vi.spyOn(windowControls, 'closeWindow').mockResolvedValue(true);
    const wrapper = mount(MiniConfirmView, withPinia());
    await flushPromises();

    await wrapper.get('[data-testid="mini-confirm-dock"]').trigger('click');

    expect(closeDock).toHaveBeenCalledTimes(1);
    expect(closeConfirmation).toHaveBeenCalledTimes(1);
  });

  it('tells the dock it is on screen, and that it is done', async () => {
    const announce = vi.spyOn(bridge, 'sendCloseQuestionOpen').mockResolvedValue(true);
    vi.spyOn(windowControls, 'closeWindow').mockResolvedValue(true);
    const wrapper = mount(MiniConfirmView, withPinia());
    await flushPromises();

    expect(announce).toHaveBeenCalledWith(true);

    await wrapper.get('[data-testid="mini-confirm-cancel"]').trigger('click');
    await flushPromises();

    expect(announce).toHaveBeenLastCalledWith(false);

    wrapper.unmount();
  });

  // The window carries no frame of its own, so the key has to stand in for the cross.
  it('leaves the question by the escape key', async () => {
    const closeConfirmation = vi.spyOn(windowControls, 'closeWindow').mockResolvedValue(true);
    const wrapper = mount(MiniConfirmView, withPinia());

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();

    expect(closeConfirmation).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('quits the app directly when that choice is confirmed', async () => {
    const quit = vi.spyOn(windowControls, 'quitApp').mockResolvedValue(true);
    const closeConfirmation = vi.spyOn(windowControls, 'closeWindow').mockResolvedValue(true);
    const wrapper = mount(MiniConfirmView, withPinia());
    await flushPromises();

    await wrapper.get('[data-testid="mini-confirm-app"]').trigger('click');

    expect(quit).toHaveBeenCalledTimes(1);
    expect(closeConfirmation).toHaveBeenCalledTimes(1);
  });
});
