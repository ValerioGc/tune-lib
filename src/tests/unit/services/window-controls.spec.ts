import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
  show: vi.fn(),
  setFocus: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: mocks.minimize,
    toggleMaximize: mocks.toggleMaximize,
    close: mocks.close,
    show: mocks.show,
    setFocus: mocks.setFocus,
  }),
}));

import {
  closeWindow,
  minimizeWindow,
  showCurrentWindow,
  toggleMaximizeWindow,
} from '@/services/window-controls';

const scopedWindow = window as unknown as Record<string, unknown>;

beforeEach(() => {
  mocks.minimize.mockResolvedValue(undefined);
  mocks.toggleMaximize.mockResolvedValue(undefined);
  mocks.close.mockResolvedValue(undefined);
  mocks.show.mockResolvedValue(undefined);
  mocks.setFocus.mockResolvedValue(undefined);
});

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('window commands', () => {
  it('focuses an auxiliary window only after it has been shown', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    let finishShowing: () => void = () => {};
    mocks.show.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishShowing = resolve;
        }),
    );

    const showing = showCurrentWindow();
    await vi.waitFor(() => expect(mocks.show).toHaveBeenCalledTimes(1));
    expect(mocks.setFocus).not.toHaveBeenCalled();
    finishShowing();
    await expect(showing).resolves.toBe(true);
    expect(mocks.setFocus).toHaveBeenCalledTimes(1);
  });

  it('do nothing outside the desktop shell', async () => {
    await expect(minimizeWindow()).resolves.toBe(false);
    await expect(toggleMaximizeWindow()).resolves.toBe(false);
    await expect(closeWindow()).resolves.toBe(false);

    expect(mocks.minimize).not.toHaveBeenCalled();
    expect(mocks.toggleMaximize).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('controls the window inside the shell', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};

    await expect(minimizeWindow()).resolves.toBe(true);
    await expect(toggleMaximizeWindow()).resolves.toBe(true);
    await expect(closeWindow()).resolves.toBe(true);

    expect(mocks.minimize).toHaveBeenCalledTimes(1);
    expect(mocks.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it('report failure without propagating the error', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.close.mockRejectedValue(new Error('window already closed'));

    await expect(closeWindow()).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
