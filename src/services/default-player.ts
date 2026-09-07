import { isTauriRuntime } from '@/config/app-config';

const WINDOWS_DEFAULT_APPS_SETTINGS = 'ms-settings:defaultapps';

/** Checks the effective defaults for every supported format; null means unavailable. */
export async function isDefaultAudioPlayer(): Promise<boolean | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<boolean | null>('is_default_audio_player');
  } catch (error) {
    console.error('Unable to read default audio player associations', error);
    return null;
  }
}

/**
 * Opens the operating system page where the user can choose default applications.
 * Modern Windows does not allow apps to silently claim default audio associations.
 */
export async function openDefaultAudioPlayerSettings(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(WINDOWS_DEFAULT_APPS_SETTINGS);

    return true;
  } catch (error) {
    console.error('Unable to open default application settings', error);

    return false;
  }
}
