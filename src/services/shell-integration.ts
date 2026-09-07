import { isTauriRuntime } from '@/config/app-config';

/**
 * The parts of the shell the settings drive: the tray, and the entry the system reads to
 * start the app on its own. Outside the desktop shell every call is a no-op, so the same
 * settings work in the browser and in the tests.
 */
async function invokeCommand(command: string, payload: Record<string, unknown>): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke(command, payload);

    return true;
  } catch (error) {
    console.error(`Shell command ${command} failed`, error);

    return false;
  }
}

/** Whether closing the window leaves the app running in the tray. */
export async function applyCloseToTray(enabled: boolean): Promise<boolean> {
  return invokeCommand('set_close_to_tray', { enabled });
}

/** What the tray menu says, and what it can offer while it says it. */
export interface TrayMenu {
  show: string;
  bringToFront: string;
  stop: string;
  quit: string;
  canStop: boolean;
  canBringToFront: boolean;
}

/**
 * Writes the tray menu: its words, and whether the player has anything to stop.
 *
 * The menu is built by the shell, so it learns both from here, and is written again on a
 * change of language or of what the player holds. Named rather than ordered: six arguments
 * in a row are six chances to write the same word in the wrong place.
 */
export async function applyTrayMenu(menu: TrayMenu): Promise<boolean> {
  return invokeCommand('set_tray_menu', { ...menu });
}

/**
 * Runs the callback when the tray asks for the playback to stop.
 *
 * The sound is played by the webview, so the menu item can only send word: returns the
 * function that stops listening, or null outside the desktop shell.
 */
export async function onTrayStopPlayback(stop: () => void): Promise<(() => void) | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { listen } = await import('@tauri-apps/api/event');

    return await listen('tray://stop-playback', () => stop());
  } catch (error) {
    console.error('Tray listener failed', error);

    return null;
  }
}

/**
 * Registers or clears the system autostart entry.
 *
 * The entry always carries the `--minimized` argument: it says the app was started by the
 * system, not by the user. Whether that means staying out of sight is a setting the app
 * reads at launch.
 */
export async function setAutostart(enabled: boolean): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart');

    if (await isEnabled()) {
      await disable();
    }

    if (enabled) {
      await enable();
    }

    return true;
  } catch (error) {
    console.error('Autostart command failed', error);

    return false;
  }
}

/**
 * Opens the floating dock, or brings back the one already on screen.
 *
 * It is a window of its own: the main one is going to the tray, and a webview goes with the
 * window that holds it. The sound stays with the main window, so the dock only asks.
 */
export async function openMiniPlayer(
  vertical: boolean,
  alwaysOnTop: boolean,
  expanded: boolean,
  position: { x: number; y: number } | null,
): Promise<boolean> {
  return invokeCommand('open_mini_player', {
    vertical,
    alwaysOnTop,
    expanded,
    position: position === null ? null : [position.x, position.y],
  });
}

export async function closeMiniPlayer(): Promise<boolean> {
  return invokeCommand('close_mini_player', {});
}

/** Opens the confirmation as its own centred window, above the floating player. */
export async function openMiniCloseConfirmation(): Promise<boolean> {
  return invokeCommand('open_mini_close_confirmation', {});
}

/** Reshapes the dock where it stands, without opening it again. */
export async function applyMiniPlayerShape(
  vertical: boolean,
  alwaysOnTop: boolean,
  expanded: boolean,
): Promise<boolean> {
  return invokeCommand('set_mini_player_shape', { vertical, alwaysOnTop, expanded });
}

/** Changes only the dock z-order, without resizing or moving it. */
export async function applyMiniPlayerAlwaysOnTop(alwaysOnTop: boolean): Promise<boolean> {
  return invokeCommand('set_mini_player_always_on_top', { alwaysOnTop });
}
