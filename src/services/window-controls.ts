import { isTauriRuntime } from '@/config/app-config';
import { closeMiniPlayer } from '@/services/shell-integration';

/**
 * Window buttons of the custom titlebar.
 *
 * The Tauri window API is imported on demand: outside the shell (browser, tests) there is
 * no window to drive, so every action is a no-op instead of a crash at import time.
 */
async function withWindow(action: (appWindow: WindowHandle) => Promise<void>): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await action(getCurrentWindow());

    return true;
  } catch (error) {
    console.error('Window command failed', error);

    return false;
  }
}

interface WindowHandle {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  hide: () => Promise<void>;
  show: () => Promise<void>;
  unminimize: () => Promise<void>;
  setFocus: () => Promise<void>;
}

export async function minimizeWindow(): Promise<boolean> {
  return withWindow((appWindow) => appWindow.minimize());
}

export async function toggleMaximizeWindow(): Promise<boolean> {
  return withWindow((appWindow) => appWindow.toggleMaximize());
}

export async function closeWindow(): Promise<boolean> {
  return withWindow((appWindow) => appWindow.close());
}

/** Where this window stands, in logical pixels, or null outside the desktop shell. */
export async function windowPosition(): Promise<{ x: number; y: number } | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    const position = await appWindow.outerPosition();
    const factor = await appWindow.scaleFactor();
    const logical = position.toLogical(factor);

    return { x: logical.x, y: logical.y };
  } catch (error) {
    console.error('Reading the window position failed', error);

    return null;
  }
}

/** Runs the callback whenever this window is moved, and returns the way to stop. */
export async function onWindowMoved(
  run: (position: { x: number; y: number }) => void,
): Promise<(() => void) | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    const factor = await appWindow.scaleFactor();

    return await appWindow.onMoved(({ payload }) => {
      const logical = payload.toLogical(factor);
      run({ x: logical.x, y: logical.y });
    });
  } catch (error) {
    console.error('Following the window position failed', error);

    return null;
  }
}

/** Closes the app for good, dock included. */
export async function quitApp(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('quit_app');

    return true;
  } catch (error) {
    console.error('Quit failed', error);

    return false;
  }
}

/** Leaves the app running with no window on screen, reachable from the tray. */
export async function hideWindow(): Promise<boolean> {
  return withWindow((appWindow) => appWindow.hide());
}

/** Shows the current auxiliary window after its own webview has mounted. */
export async function showCurrentWindow(): Promise<boolean> {
  return withWindow(async (appWindow) => {
    await appWindow.show();
    await appWindow.setFocus();
  });
}

/**
 * Brings the window back, wherever the system left it.
 *
 * The dock stood in for the window while it was away, so it goes with its return.
 */
export async function showWindow(): Promise<boolean> {
  await closeMiniPlayer();

  return withWindow(async (appWindow) => {
    await appWindow.show();
    await appWindow.unminimize();
    await appWindow.setFocus();
  });
}
