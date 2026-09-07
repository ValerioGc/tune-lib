import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  openUrl: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: mocks.openUrl }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));

import { isDefaultAudioPlayer, openDefaultAudioPlayerSettings } from '@/services/default-player';

const scopedWindow = window as unknown as Record<string, unknown>;

beforeEach(() => {
  mocks.openUrl.mockResolvedValue(undefined);
});

describe('isDefaultAudioPlayer', () => {
  it('does not query native associations in the browser', async () => {
    await expect(isDefaultAudioPlayer()).resolves.toBeNull();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it.each([true, false, null])('returns the native association status %s', async (status) => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    mocks.invoke.mockResolvedValue(status);
    await expect(isDefaultAudioPlayer()).resolves.toBe(status);
    expect(mocks.invoke).toHaveBeenCalledWith('is_default_audio_player');
  });

  it('reports unavailable detection without rejecting', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.invoke.mockRejectedValue(new Error('unavailable'));
    await expect(isDefaultAudioPlayer()).resolves.toBeNull();
  });
});

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.clearAllMocks();
});

describe('openDefaultAudioPlayerSettings', () => {
  it('does nothing outside the shell', async () => {
    await expect(openDefaultAudioPlayerSettings()).resolves.toBe(false);
    expect(mocks.openUrl).not.toHaveBeenCalled();
  });

  it('opens Windows default app settings inside the shell', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};

    await expect(openDefaultAudioPlayerSettings()).resolves.toBe(true);
    expect(mocks.openUrl).toHaveBeenCalledWith('ms-settings:defaultapps');
  });

  it('reports failures without throwing', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.openUrl.mockRejectedValue(new Error('blocked'));

    await expect(openDefaultAudioPlayerSettings()).resolves.toBe(false);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
