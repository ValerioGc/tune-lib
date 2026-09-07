import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ openUrl: vi.fn() }));

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: mocks.openUrl }));

import { openExternal } from '@/services/external-link';

const scopedWindow = window as unknown as Record<string, unknown>;
const url = 'https://github.com/esempio/progetto';

beforeEach(() => {
  mocks.openUrl.mockResolvedValue(undefined);
});

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('openExternal', () => {
  it('uses the system plugin inside the shell', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};

    await expect(openExternal(url)).resolves.toBe(true);
    expect(mocks.openUrl).toHaveBeenCalledWith(url);
  });

  it('opens a new browser tab', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    await expect(openExternal(url)).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith(url, '_blank', 'noopener');
    expect(mocks.openUrl).not.toHaveBeenCalled();
  });

  it('reports failure without propagating the error', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.openUrl.mockRejectedValue(new Error('no browser available'));

    await expect(openExternal(url)).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
